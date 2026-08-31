/**
 * F11 — server-side OpenAI tool loop for allowlisted AgentAction HTTP calls.
 * R2–R3: policy (identity + confirmation), credential load, pre-flight re-fetch.
 */

import prisma from "@/lib/prisma";
import {
  MAX_TOOL_STEPS,
  TOOL_LOOP_DEADLINE_MS,
  TOOL_RUN_STATUS,
  canInvokeAgentAction,
} from "@/lib/actions/action-config";
import { executeHttpAction } from "@/lib/actions/http-executor";
import {
  actionsToOpenAiTools,
  validateToolArgs,
} from "@/lib/actions/tool-definitions";
import {
  formatToolResultForModel,
  safeToolErrorMessage,
} from "@/lib/actions/tool-errors";
import { evaluateActionPolicy } from "@/lib/actions/policy";
import { resolveIdentityMode } from "@/lib/actions/identity-mode";
import { hashArgs } from "@/lib/actions/identity";
import { getApprovedConfirmation, createPendingConfirmation } from "@/lib/services/confirmation.service";
import { loadDecryptedCredential } from "@/lib/services/credential.service";
import { rateLimit } from "@/lib/rate-limit";
import {
  actionOutboundLimitOpts,
  actionWorkspaceDailyLimitOpts,
} from "@/lib/rate-limit-config";
import {
  getCachedGetResult,
  isGetMethod,
  setCachedGetResult,
} from "@/lib/actions/get-cache";
import {
  orderToolCallsGetFirst,
  withOutboundSlot,
} from "@/lib/actions/outbound-semaphore";
import { chatCompletionTurn } from "@/lib/services/ai/llm.provider";
import { safeLog, safeLogError } from "@/lib/observability/safe-log";
import {
  executeMcpToolAction,
  listEnabledMcpToolsForAgent,
} from "@/lib/services/mcp.service";

const MAX_TOOL_RESULT_CHARS = 4000;

/**
 * Load enabled HTTP actions + MCP tools for an agent (chat invoke path).
 * Respects agent.actionsEnabled kill switch (disables both).
 * @returns {Promise<{ actions: Array, workspaceId: string|null }>}
 */
export async function listEnabledActionsForAgent(agentId) {
  if (!agentId) return { actions: [], workspaceId: null };
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { actionsEnabled: true, workspaceId: true },
  });
  if (!agent || agent.actionsEnabled === false) {
    return { actions: [], workspaceId: agent?.workspaceId ?? null };
  }
  const [actions, mcpTools] = await Promise.all([
    prisma.agentAction.findMany({
      where: { agentId, enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    listEnabledMcpToolsForAgent(agentId),
  ]);
  return {
    actions: [...actions, ...mcpTools],
    workspaceId: agent.workspaceId,
  };
}

/**
 * Run chat completion with optional tools. Falls back to plain text when no tools.
 * @returns {Promise<{ content: string, latencyMs: number|null, toolSteps: Array, degraded?: boolean }>}
 */
export async function chatCompletionWithTools({
  system,
  messages,
  actions = [],
  signal,
  agentId,
  workspaceId = null,
  conversationId = null,
  requestId = null,
  customerSubject = null,
  endUserAccessToken = null,
  publicAccess = false,
  lastUserMessage = null,
  maxSteps = MAX_TOOL_STEPS,
}) {
  const started = Date.now();
  const tools = actionsToOpenAiTools(actions);
  const byName = new Map(actions.map((a) => [a.name, a]));
  const toolSteps = [];

  if (!tools.length) {
    const { chatCompletion } = await import("@/lib/services/ai/llm.provider");
    const reply = await chatCompletion({ system, messages, signal });
    return { ...reply, toolSteps };
  }

  /** @type {Array<Record<string, unknown>>} */
  const loopMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let stepsUsed = 0;

  while (stepsUsed < maxSteps) {
    if (signal?.aborted) {
      const err = new Error("Request cancelled");
      err.status = 499;
      err.details = { code: "ABORTED" };
      throw err;
    }
    if (Date.now() - started > TOOL_LOOP_DEADLINE_MS) {
      break;
    }

    const turn = await chatCompletionTurn({
      system,
      messages: loopMessages,
      tools,
      signal,
    });

    if (!turn.toolCalls?.length) {
      const content = String(turn.content || "").trim();
      if (!content) {
        const err = new Error("AI returned an empty reply");
        err.status = 502;
        throw err;
      }
      return {
        content,
        latencyMs: Date.now() - started,
        toolSteps,
      };
    }

    loopMessages.push({
      role: "assistant",
      content: turn.content || null,
      tool_calls: turn.toolCalls,
    });

    for (const call of orderToolCallsGetFirst(turn.toolCalls, byName)) {
      if (stepsUsed >= maxSteps) break;
      stepsUsed += 1;

      const name = call?.function?.name || "";
      const callId = call?.id || `call_${stepsUsed}`;
      let argsRaw = call?.function?.arguments || "{}";

      const step = await invokeOneTool({
        name,
        argsRaw,
        byName,
        agentId,
        workspaceId,
        conversationId,
        requestId,
        customerSubject,
        endUserAccessToken,
        publicAccess,
        lastUserMessage,
        stepsUsed,
        maxSteps,
      });
      toolSteps.push(step);

      loopMessages.push({
        role: "tool",
        tool_call_id: callId,
        content: truncateToolContent(step.resultForModel),
      });
    }
  }

  // Max steps / deadline — one final text turn without tools
  const finalTurn = await chatCompletionTurn({
    system: `${system}\n\nYou have reached the tool-call limit or deadline. Answer the user from knowledge and tool results already available. If you still lack a required id or fact, ask a short clarifying question. Do not invent live API data.`,
    messages: loopMessages,
    signal,
  });

  const content = String(finalTurn.content || "").trim();
  if (!content) {
    return {
      content:
        "I looked some things up but could not finish a clear answer. Please share any missing details (like an order id) and try again.",
      latencyMs: Date.now() - started,
      toolSteps,
    };
  }

  return {
    content,
    latencyMs: Date.now() - started,
    toolSteps,
  };
}

async function failToolRun({
  auditBase,
  requestId,
  agentId,
  conversationId,
  actionName,
  actionId = null,
  mcpToolId = null,
  actionVersion = null,
  status,
  errorCode,
  errorCategory,
  durationMs = 0,
  httpStatus = null,
  forModel,
  bodyText,
  extra = {},
}) {
  await auditToolRun({
    ...auditBase,
    actionId,
    mcpToolId,
    actionVersion,
    status,
    durationMs,
    httpStatus,
    errorCode,
    errorCategory,
  });
  logToolStep({
    requestId,
    agentId,
    conversationId,
    actionName,
    status,
    durationMs,
    httpStatus,
    errorCode,
  });
  const modelPayload = { ok: false, status, errorCode };
  if (bodyText !== undefined) modelPayload.bodyText = bodyText;
  return {
    name: actionName,
    status,
    httpStatus,
    durationMs,
    errorCode,
    resultForModel: forModel(modelPayload),
    ...extra,
  };
}

async function invokeOneTool({
  name,
  argsRaw,
  byName,
  agentId,
  workspaceId = null,
  conversationId,
  requestId,
  customerSubject = null,
  endUserAccessToken = null,
  publicAccess = false,
  lastUserMessage = null,
  stepsUsed,
  maxSteps,
}) {
  const action = byName.get(name);
  const guest = Boolean(publicAccess) && !customerSubject;
  const forModel = (result, extra = {}) =>
    formatToolResultForModel(result, {
      actionName: action?.name || name,
      guest,
      ...extra,
    });
  const auditBase = {
    agentId,
    workspaceId,
    conversationId,
    requestId,
    customerSubject,
  };

  if (!action || !canInvokeAgentAction(action, agentId)) {
    const status = action && action.agentId === agentId && !action.enabled
      ? TOOL_RUN_STATUS.DISABLED
      : TOOL_RUN_STATUS.UNKNOWN_TOOL;
    return failToolRun({
      auditBase,
      requestId,
      agentId,
      conversationId,
      actionName: name || "unknown",
      actionId: action?.id ?? null,
      actionVersion: action?.version ?? null,
      status,
      errorCode: status,
      errorCategory: "authz",
      forModel,
      bodyText: safeToolErrorMessage({ status, errorCode: status }),
    });
  }

  if (stepsUsed > maxSteps) {
    return failToolRun({
      auditBase,
      requestId,
      agentId,
      conversationId,
      actionName: action.name,
      actionId: action.id,
      actionVersion: action.version,
      status: TOOL_RUN_STATUS.MAX_STEPS,
      errorCode: "MAX_STEPS",
      errorCategory: "limit",
      forModel,
    });
  }

  const validated = validateToolArgs(action.inputSchemaJson, argsRaw);
  if (!validated.ok) {
    return failToolRun({
      auditBase,
      requestId,
      agentId,
      conversationId,
      actionName: action.name,
      actionId: action.id,
      actionVersion: action.version,
      status: TOOL_RUN_STATUS.SCHEMA_INVALID,
      errorCode: "SCHEMA_INVALID",
      errorCategory: "schema",
      forModel,
      bodyText: validated.error,
    });
  }

  // Policy: identity + confirmation before any outbound call
  let confirmationStatus = null;
  const isMcp = Boolean(action._mcp);
  // Embed: confirm every live call. Studio: WRITE/DESTRUCTIVE/flagged only.
  const needsConfirmGate =
    Boolean(publicAccess) ||
    Boolean(action.requiresConfirmation) ||
    action.riskLevel === "WRITE" ||
    action.riskLevel === "DESTRUCTIVE";

  // HTTP confirmations only (ActionConfirmation.actionId). MCP WRITE stays gated until F14.
  if (needsConfirmGate && conversationId && !isMcp) {
    const approved = await getApprovedConfirmation(
      conversationId,
      action.id,
      hashArgs(validated.args)
    );
    if (approved) confirmationStatus = "APPROVED";
  }

  const policy = evaluateActionPolicy({
    action,
    customerSubject,
    endUserAccessToken,
    confirmationStatus,
    publicAccess,
    lastUserMessage,
    toolArgs: validated.args,
  });

  if (!policy.allow) {
    const code = policy.code || "POLICY_DENIED";
    let pendingConfirmation = null;

    // F14-A: create PENDING row so the chat UI can Approve / Cancel.
    if (
      code === "CONFIRMATION_REQUIRED" &&
      conversationId &&
      !isMcp &&
      action?.id
    ) {
      try {
        const row = await createPendingConfirmation(
          conversationId,
          action.id,
          validated.args
        );
        pendingConfirmation = {
          id: row.id,
          conversationId: row.conversationId,
          actionId: row.actionId,
          actionName: row.actionName || action.name,
          actionDescription: row.actionDescription || action.description || null,
          args: validated.args,
          argsHash: row.argsHash,
          status: row.status,
          expiresAt: row.expiresAt,
        };
      } catch (err) {
        safeLogError("createPendingConfirmation failed", {
          requestId,
          agentId,
          conversationId,
          actionName: action.name,
          message: err?.message,
        });
      }
    }

    await auditToolRun({
      ...auditBase,
      actionId: isMcp ? null : action.id,
      mcpToolId: isMcp ? action.id : null,
      actionVersion: action.version,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs: 0,
      httpStatus: null,
      errorCode: code,
      errorCategory: "policy",
    });
    logToolStep({
      requestId,
      agentId,
      conversationId,
      actionName: action.name,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs: 0,
      errorCode: code,
    });

    const bodyText = pendingConfirmation
      ? "A Confirm button was shown to the user in chat. Tell them briefly what will happen and wait for their click — do not invent that the action completed."
      : policy.message || safeToolErrorMessage({ errorCode: code });

    return {
      name: action.name,
      status: TOOL_RUN_STATUS.ERROR,
      httpStatus: null,
      durationMs: 0,
      errorCode: code,
      pendingConfirmation,
      resultForModel: forModel({
        ok: false,
        status: TOOL_RUN_STATUS.ERROR,
        errorCode: code,
        bodyText,
      }),
    };
  }

  if (isMcp) {
    const limitedMcp = rateLimit(
      `actions:outbound:${agentId}`,
      actionOutboundLimitOpts()
    );
    if (!limitedMcp.ok) {
      return failToolRun({
        auditBase,
        requestId,
        agentId,
        conversationId,
        actionName: action.name,
        mcpToolId: action.id,
        actionVersion: action.version,
        status: TOOL_RUN_STATUS.ERROR,
        errorCode: "RATE_LIMITED",
        errorCategory: "limit",
        forModel,
      });
    }

    const mcpResult = await withOutboundSlot(agentId, () =>
      executeMcpToolAction({
        action,
        args: validated.args,
        workspaceId,
        signal: undefined,
      })
    );

    const mcpStatus = mcpResult.ok
      ? TOOL_RUN_STATUS.OK
      : TOOL_RUN_STATUS[mcpResult.status] || TOOL_RUN_STATUS.ERROR;

    await auditToolRun({
      ...auditBase,
      actionId: null,
      mcpToolId: action.id,
      actionVersion: action.version,
      status: mcpStatus,
      durationMs: mcpResult.durationMs,
      httpStatus: mcpResult.httpStatus,
      errorCode: mcpResult.errorCode,
      errorCategory: mcpResult.ok ? null : "mcp",
    });
    logToolStep({
      requestId,
      agentId,
      conversationId,
      actionName: action.name,
      status: mcpStatus,
      durationMs: mcpResult.durationMs,
      httpStatus: mcpResult.httpStatus,
      errorCode: mcpResult.errorCode,
      mcpServerId: action._mcp?.serverId,
      mcpToolId: action.id,
    });

    return {
      name: action.name,
      status: mcpStatus,
      httpStatus: mcpResult.httpStatus,
      durationMs: mcpResult.durationMs,
      errorCode: mcpResult.errorCode,
      resultForModel: forModel(
        {
          ok: mcpResult.ok,
          status: mcpStatus,
          errorCode: mcpResult.errorCode,
          bodyText: mcpResult.bodyText,
          httpStatus: mcpResult.httpStatus,
        },
        { actionName: action.name }
      ),
    };
  }

  const allowLocalDemo =
    process.env.NODE_ENV !== "production" ||
    /localhost|127\.0\.0\.1/i.test(action.urlTemplate);

  const useGetCache = isGetMethod(action.method);
  if (useGetCache) {
    const cached = getCachedGetResult(action.id, validated.args);
    if (cached) {
      await auditToolRun({
        ...auditBase,
        actionId: action.id,
        actionVersion: action.version,
        status: cached.status,
        durationMs: 0,
        httpStatus: cached.httpStatus,
        errorCode: "CACHE_HIT",
        errorCategory: "cache",
      });
      logToolStep({
        requestId,
        agentId,
        conversationId,
        actionName: action.name,
        status: cached.status,
        durationMs: 0,
        httpStatus: cached.httpStatus,
        errorCode: "CACHE_HIT",
      });
      return {
        name: action.name,
        status: cached.status,
        httpStatus: cached.httpStatus,
        durationMs: 0,
        errorCode: "CACHE_HIT",
        resultForModel: forModel(cached),
      };
    }
  }

  const limited = rateLimit(
    `actions:outbound:${agentId}`,
    actionOutboundLimitOpts()
  );
  if (!limited.ok) {
    return failToolRun({
      auditBase,
      requestId,
      agentId,
      conversationId,
      actionName: action.name,
      actionId: action.id,
      actionVersion: action.version,
      status: TOOL_RUN_STATUS.ERROR,
      errorCode: "RATE_LIMITED",
      errorCategory: "limit",
      forModel,
    });
  }

  if (workspaceId) {
    const daily = rateLimit(
      `actions:daily:${workspaceId}`,
      actionWorkspaceDailyLimitOpts()
    );
    if (!daily.ok) {
      return failToolRun({
        auditBase,
        requestId,
        agentId,
        conversationId,
        actionName: action.name,
        actionId: action.id,
        actionVersion: action.version,
        status: TOOL_RUN_STATUS.ERROR,
        errorCode: "DAILY_LIMIT",
        errorCategory: "limit",
        forModel,
      });
    }
  }

  // Pre-flight: re-load action (enabled / version / credential) immediately before HTTP
  const fresh = await prisma.agentAction.findFirst({
    where: { id: action.id, agentId },
  });
  if (!fresh || !fresh.enabled) {
    await auditToolRun({
      ...auditBase,
      actionId: action.id,
      actionVersion: action.version,
      status: TOOL_RUN_STATUS.DISABLED,
      durationMs: 0,
      httpStatus: null,
      errorCode: "ACTION_STALE",
      errorCategory: "authz",
    });
    return {
      name: action.name,
      status: TOOL_RUN_STATUS.DISABLED,
      httpStatus: null,
      durationMs: 0,
      errorCode: "ACTION_STALE",
      resultForModel: forModel({
        ok: false,
        status: TOOL_RUN_STATUS.DISABLED,
        errorCode: "ACTION_STALE",
        bodyText: "Action was disabled or changed; try again.",
      }),
    };
  }

  let credential = null;
  if (fresh.credentialId && workspaceId) {
    try {
      credential = await loadDecryptedCredential(fresh.credentialId, workspaceId);
    } catch (err) {
      const code = err?.details?.code || err?.code || "CREDENTIAL_REVOKED";
      await auditToolRun({
        ...auditBase,
        actionId: fresh.id,
        actionVersion: fresh.version,
        status: TOOL_RUN_STATUS.ERROR,
        durationMs: 0,
        httpStatus: null,
        errorCode: code,
        errorCategory: "credential",
      });
      return {
        name: fresh.name,
        status: TOOL_RUN_STATUS.ERROR,
        httpStatus: null,
        durationMs: 0,
        errorCode: code,
        resultForModel: forModel({
          ok: false,
          status: TOOL_RUN_STATUS.ERROR,
          errorCode: code,
          bodyText: "Credential unavailable. Ask the owner to re-attach a key.",
        }),
      };
    }
  } else if (fresh.credentialId && !workspaceId) {
    await auditToolRun({
      ...auditBase,
      actionId: fresh.id,
      actionVersion: fresh.version,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs: 0,
      httpStatus: null,
      errorCode: "CREDENTIAL_MISSING",
      errorCategory: "credential",
    });
    return {
      name: fresh.name,
      status: TOOL_RUN_STATUS.ERROR,
      httpStatus: null,
      durationMs: 0,
      errorCode: "CREDENTIAL_MISSING",
      resultForModel: forModel({
        ok: false,
        status: TOOL_RUN_STATUS.ERROR,
        errorCode: "CREDENTIAL_MISSING",
        bodyText: "Credential unavailable.",
      }),
    };
  }

  let result;
  try {
    result = await withOutboundSlot(agentId, () =>
      executeHttpAction({
        method: fresh.method,
        urlTemplate: fresh.urlTemplate,
        headersJson: fresh.headersJson,
        args: validated.args,
        timeoutMs: fresh.timeoutMs,
        allowLocalDemo,
        retryOnce: true,
        credential,
        frozenHost: fresh.frozenHost,
        outputSchemaJson: fresh.outputSchemaJson,
        idempotent: fresh.idempotent !== false,
        riskLevel: fresh.riskLevel || "READ",
        endUserAccessToken,
        preferEndUserAuth:
          resolveIdentityMode(fresh) === "END_USER_TOKEN" &&
          Boolean(endUserAccessToken),
        guestResponseCap: guest,
      })
    );
  } catch (err) {
    safeLogError("tool execute crashed", {
      requestId,
      agentId,
      conversationId,
      actionName: fresh.name,
      code: "FETCH_ERROR",
    });
    result = {
      ok: false,
      status: TOOL_RUN_STATUS.ERROR,
      httpStatus: null,
      durationMs: 0,
      errorCode: "FETCH_ERROR",
      bodyText: "Request failed",
      truncated: false,
      retried: false,
    };
  }

  if (result?.errorCode === "CONCURRENCY_LIMIT") {
    await auditToolRun({
      ...auditBase,
      actionId: fresh.id,
      actionVersion: fresh.version,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs: result.durationMs || 0,
      httpStatus: null,
      errorCode: "CONCURRENCY_LIMIT",
      errorCategory: "limit",
    });
    logToolStep({
      requestId,
      agentId,
      conversationId,
      actionName: fresh.name,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs: result.durationMs || 0,
      errorCode: "CONCURRENCY_LIMIT",
    });
    return {
      name: fresh.name,
      status: TOOL_RUN_STATUS.ERROR,
      httpStatus: null,
      durationMs: result.durationMs || 0,
      errorCode: "CONCURRENCY_LIMIT",
      resultForModel: forModel(result),
    };
  }

  if (useGetCache && result?.ok) {
    setCachedGetResult(fresh.id, validated.args, result);
  }

  await auditToolRun({
    ...auditBase,
    actionId: fresh.id,
    actionVersion: fresh.version,
    status: result.status,
    durationMs: result.durationMs,
    httpStatus: result.httpStatus,
    errorCode: result.errorCode,
    errorCategory: result.ok ? null : "http",
  });
  logToolStep({
    requestId,
    agentId,
    conversationId,
    actionName: fresh.name,
    status: result.status,
    durationMs: result.durationMs,
    httpStatus: result.httpStatus,
    errorCode: result.errorCode,
    retried: result.retried,
  });

  return {
    name: fresh.name,
    status: result.status,
    httpStatus: result.httpStatus,
    durationMs: result.durationMs,
    errorCode: result.errorCode,
    resultForModel: forModel(result),
  };
}

function logToolStep(meta) {
  safeLog("info", "tool.run", {
    requestId: meta.requestId,
    agentId: meta.agentId,
    conversationId: meta.conversationId,
    actionName: meta.actionName,
    status: meta.status,
    durationMs: meta.durationMs,
    httpStatus: meta.httpStatus,
    errorCode: meta.errorCode,
    retried: meta.retried,
    mcpServerId: meta.mcpServerId,
    mcpToolId: meta.mcpToolId,
  });
}

async function auditToolRun(data) {
  try {
    await prisma.toolRun.create({
      data: {
        agentId: data.agentId,
        actionId: data.actionId ?? null,
        mcpToolId: data.mcpToolId ?? null,
        conversationId: data.conversationId,
        workspaceId: data.workspaceId ?? null,
        customerSubject: data.customerSubject ?? null,
        actionVersion: data.actionVersion ?? null,
        status: data.status,
        durationMs: data.durationMs,
        httpStatus: data.httpStatus,
        errorCode: data.errorCode,
        errorCategory: data.errorCategory ?? null,
        requestId: data.requestId,
      },
    });
  } catch (err) {
    safeLogError("toolRun audit failed", {
      agentId: data.agentId,
      message: err?.message,
    });
  }
}

function truncateToolContent(text) {
  const s = String(text || "");
  if (s.length <= MAX_TOOL_RESULT_CHARS) return s;
  return `${s.slice(0, MAX_TOOL_RESULT_CHARS)}…`;
}
