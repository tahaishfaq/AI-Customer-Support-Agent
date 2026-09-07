/**
 * F11 — invoke a single allowlisted tool (HTTP / MCP).
 * Used by Orchestrator loop (O3). Policy + credentials stay outside the LLM.
 */

import prisma from "@/lib/prisma";
import {
  TOOL_RUN_STATUS,
  canInvokeAgentAction,
} from "@/lib/actions/action-config";
import { executeHttpAction } from "@/lib/actions/http-executor";
import { validateToolArgs } from "@/lib/actions/tool-definitions";
import {
  formatToolResultForModel,
  safeToolErrorMessage,
} from "@/lib/actions/tool-errors";
import { evaluateActionPolicy } from "@/lib/actions/policy";
import { assertConversationAgentBinding } from "@/lib/actions/authz-binding";
import { resolveIdentityMode } from "@/lib/actions/identity-mode";
import { hashArgs } from "@/lib/actions/identity";
import { createPendingConfirmation, claimApprovedConfirmation } from "@/lib/services/confirmation.service";
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
import { withOutboundSlot } from "@/lib/actions/outbound-semaphore";
import { safeLog, safeLogError } from "@/lib/observability/safe-log";
import { executeMcpToolAction } from "@/lib/services/mcp.service";
import { withCapabilityResult } from "@/lib/capabilities/from-tool-step";
import { isBuiltinAction } from "@/lib/capabilities/builtins";
import { invokeBuiltinCapability } from "@/lib/capabilities/adapters/builtin.adapter";
import {
  beginWriteIdempotency,
  buildWriteIdempotencyKey,
  completeWriteIdempotency,
  failWriteIdempotency,
  isWriteIdempotencyEligible,
} from "@/lib/actions/write-idempotency";

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
  return withCapabilityResult({
    name: actionName,
    status,
    httpStatus,
    durationMs,
    errorCode,
    resultForModel: forModel(modelPayload),
    ...extra,
  });
}

export async function invokeOneTool({
  name,
  argsRaw,
  byName,
  agentId,
  workspaceId = null,
  conversationId,
  requestId,
  customerSubject = null,
  endUserAccessToken = null,
  customerClaims = null,
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

  // Stage 5.3 — conversation must belong to this agent (when conversationId present).
  if (conversationId) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { agentId: true },
    });
    const bind = assertConversationAgentBinding({
      conversationAgentId: conv?.agentId || null,
      invokeAgentId: agentId,
      actionAgentId: action.agentId,
    });
    if (!bind.ok) {
      return failToolRun({
        auditBase,
        requestId,
        agentId,
        conversationId,
        actionName: action.name,
        actionId: action._mcp ? null : action.id,
        mcpToolId: action._mcp ? action.id : null,
        actionVersion: action.version,
        status: TOOL_RUN_STATUS.ERROR,
        errorCode: bind.code,
        errorCategory: "authz",
        forModel,
        bodyText: bind.message,
      });
    }
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

  // O4a — built-ins skip HTTP/MCP confirm gates; web_search has its own source PEP
  if (isBuiltinAction(action)) {
    return invokeBuiltinCapability({
      action,
      args: validated.args,
      agentId,
      conversationId,
      requestId,
      publicAccess,
      lastUserMessage,
      auditBase,
      auditToolRun,
      logToolStep,
    });
  }

  // Policy: identity + confirmation before any outbound call (HTTP + MCP).
  let confirmationStatus = null;
  const isMcp = Boolean(action._mcp);
  const capabilityRef = isMcp
    ? { mcpToolId: action.id }
    : { actionId: action.id };
  // Embed: confirm every live call. Studio: WRITE/DESTRUCTIVE/flagged only.
  const needsConfirmGate =
    Boolean(publicAccess) ||
    Boolean(action.requiresConfirmation) ||
    action.riskLevel === "WRITE" ||
    action.riskLevel === "DESTRUCTIVE";

  if (needsConfirmGate && conversationId && action?.id) {
    const claimed = await claimApprovedConfirmation(
      conversationId,
      capabilityRef,
      hashArgs(validated.args),
      { expectedAgentId: agentId }
    );
    if (claimed) confirmationStatus = "APPROVED";
  }

  const policy = evaluateActionPolicy({
    action,
    customerSubject,
    endUserAccessToken,
    confirmationStatus,
    publicAccess,
    lastUserMessage,
    toolArgs: validated.args,
    customerClaims,
  });

  if (!policy.allow) {
    const code = policy.code || "POLICY_DENIED";
    let pendingConfirmation = null;

    // Generic confirmation gateway — HTTP AgentAction and MCP AgentMcpTool.
    if (
      code === "CONFIRMATION_REQUIRED" &&
      conversationId &&
      action?.id
    ) {
      try {
        const row = await createPendingConfirmation(
          conversationId,
          capabilityRef,
          validated.args
        );
        pendingConfirmation = {
          id: row.id,
          conversationId: row.conversationId,
          actionId: row.actionId || null,
          mcpToolId: row.mcpToolId || null,
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

    return withCapabilityResult({
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
    });
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

    const mcpArgsHash = hashArgs(validated.args);
    const mcpWriteEligible =
      Boolean(conversationId) &&
      isWriteIdempotencyEligible({
        riskLevel: action.riskLevel,
        idempotent: true,
      });
    let mcpWriteKey = null;
    if (mcpWriteEligible) {
      mcpWriteKey = buildWriteIdempotencyKey({
        agentId,
        conversationId,
        mcpToolId: action.id,
        argsHash: mcpArgsHash,
      });
      const lease = await beginWriteIdempotency({
        idempotencyKey: mcpWriteKey,
        agentId,
        conversationId,
        mcpToolId: action.id,
        argsHash: mcpArgsHash,
      });
      if (lease.state === "replay" && lease.replay) {
        const replay = lease.replay;
        await auditToolRun({
          ...auditBase,
          actionId: null,
          mcpToolId: action.id,
          actionVersion: action.version,
          status: TOOL_RUN_STATUS.OK,
          durationMs: 0,
          httpStatus: replay.httpStatus,
          errorCode: null,
          errorCategory: null,
        });
        return withCapabilityResult({
          name: action.name,
          status: TOOL_RUN_STATUS.OK,
          httpStatus: replay.httpStatus,
          durationMs: 0,
          errorCode: null,
          resultForModel:
            replay.resultForModel ||
            forModel(
              {
                ok: true,
                status: TOOL_RUN_STATUS.OK,
                bodyText: replay.bodyText,
                httpStatus: replay.httpStatus,
              },
              { actionName: action.name }
            ),
        });
      }
      if (lease.state === "busy") {
        return failToolRun({
          auditBase,
          requestId,
          agentId,
          conversationId,
          actionName: action.name,
          mcpToolId: action.id,
          actionVersion: action.version,
          status: TOOL_RUN_STATUS.ERROR,
          errorCode: "IDEMPOTENCY_IN_FLIGHT",
          errorCategory: "limit",
          forModel,
        });
      }
    }

    const mcpResult = await withOutboundSlot(agentId, () =>
      executeMcpToolAction({
        action,
        args: validated.args,
        workspaceId,
        signal: undefined,
      })
    );

    if (mcpWriteKey) {
      if (mcpResult.ok) {
        const modelPayload = forModel(
          {
            ok: true,
            status: TOOL_RUN_STATUS.OK,
            bodyText: mcpResult.bodyText,
            httpStatus: mcpResult.httpStatus,
          },
          { actionName: action.name }
        );
        await completeWriteIdempotency(mcpWriteKey, {
          httpStatus: mcpResult.httpStatus,
          bodyText: mcpResult.bodyText,
          resultForModel: modelPayload,
        }).catch(() => null);
      } else {
        await failWriteIdempotency(mcpWriteKey, {
          errorCode: mcpResult.errorCode,
          httpStatus: mcpResult.httpStatus,
        }).catch(() => null);
      }
    }

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

    return withCapabilityResult({
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
    });
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
      return withCapabilityResult({
        name: action.name,
        status: cached.status,
        httpStatus: cached.httpStatus,
        durationMs: 0,
        errorCode: "CACHE_HIT",
        resultForModel: forModel(cached),
      });
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
    return withCapabilityResult({
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
    });
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
      return withCapabilityResult({
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
      });
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
    return withCapabilityResult({
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
    });
  }

  let writeKey = null;
  const writeArgsHash = hashArgs(validated.args);
  const writeEligible =
    Boolean(conversationId) &&
    isWriteIdempotencyEligible({
      riskLevel: fresh.riskLevel || "READ",
      idempotent: fresh.idempotent !== false,
    });
  if (writeEligible) {
    writeKey = buildWriteIdempotencyKey({
      agentId,
      conversationId,
      actionId: fresh.id,
      argsHash: writeArgsHash,
    });
    const lease = await beginWriteIdempotency({
      idempotencyKey: writeKey,
      agentId,
      conversationId,
      actionId: fresh.id,
      argsHash: writeArgsHash,
    });
    if (lease.state === "replay" && lease.replay) {
      const replay = lease.replay;
      await auditToolRun({
        ...auditBase,
        actionId: fresh.id,
        actionVersion: fresh.version,
        status: TOOL_RUN_STATUS.OK,
        durationMs: 0,
        httpStatus: replay.httpStatus,
        errorCode: null,
        errorCategory: null,
      });
      logToolStep({
        requestId,
        agentId,
        conversationId,
        actionName: fresh.name,
        status: TOOL_RUN_STATUS.OK,
        durationMs: 0,
        httpStatus: replay.httpStatus,
        errorCode: null,
        retried: false,
      });
      return withCapabilityResult({
        name: fresh.name,
        status: TOOL_RUN_STATUS.OK,
        httpStatus: replay.httpStatus,
        durationMs: 0,
        errorCode: null,
        resultForModel:
          replay.resultForModel || forModel(replay, { actionName: fresh.name }),
      });
    }
    if (lease.state === "busy") {
      return failToolRun({
        auditBase,
        requestId,
        agentId,
        conversationId,
        actionName: fresh.name,
        actionId: fresh.id,
        actionVersion: fresh.version,
        status: TOOL_RUN_STATUS.ERROR,
        errorCode: "IDEMPOTENCY_IN_FLIGHT",
        errorCategory: "limit",
        forModel,
      });
    }
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
        idempotencyKey: writeKey || null,
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

  if (writeKey) {
    if (result?.ok) {
      const modelPayload = forModel(result, { actionName: fresh.name });
      await completeWriteIdempotency(writeKey, {
        httpStatus: result.httpStatus,
        bodyText: result.bodyText,
        resultForModel: modelPayload,
      }).catch(() => null);
    } else {
      await failWriteIdempotency(writeKey, {
        errorCode: result?.errorCode,
        httpStatus: result?.httpStatus,
      }).catch(() => null);
    }
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
    return withCapabilityResult({
      name: fresh.name,
      status: TOOL_RUN_STATUS.ERROR,
      httpStatus: null,
      durationMs: result.durationMs || 0,
      errorCode: "CONCURRENCY_LIMIT",
      resultForModel: forModel(result),
    });
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

  return withCapabilityResult({
    name: fresh.name,
    status: result.status,
    httpStatus: result.httpStatus,
    durationMs: result.durationMs,
    errorCode: result.errorCode,
    resultForModel: forModel(result),
  });
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
