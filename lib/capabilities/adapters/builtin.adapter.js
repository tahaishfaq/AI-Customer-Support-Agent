/**
 * O01-O4a — Invoke built-in capabilities (handoff / safe meta).
 * No shop business rules; desk mutations go through handoff.service only.
 */

import prisma from "@/lib/prisma";
import { TOOL_RUN_STATUS } from "@/lib/actions/action-config";
import { withCapabilityResult } from "@/lib/capabilities/from-tool-step";
import { triggerHandoff } from "@/lib/services/handoff.service";
import { isWaitingForHuman, isAiPaused } from "@/lib/desk/conversation-desk";
import { safeLogError } from "@/lib/observability/safe-log";

/**
 * @param {{
 *   action: object,
 *   args: Record<string, unknown>,
 *   agentId: string,
 *   conversationId: string|null,
 *   requestId: string|null,
 *   publicAccess: boolean,
 *   auditBase: object,
 *   auditToolRun: Function,
 *   logToolStep: Function,
 * }} ctx
 */
export async function invokeBuiltinCapability(ctx) {
  const {
    action,
    args,
    agentId,
    conversationId,
    requestId,
    publicAccess,
    auditBase,
    auditToolRun,
    logToolStep,
  } = ctx;

  const builtinId = action?._builtin?.id;
  const started = Date.now();

  if (builtinId === "request_handoff") {
    return invokeRequestHandoff({
      action,
      args,
      agentId,
      conversationId,
      requestId,
      publicAccess,
      auditBase,
      auditToolRun,
      logToolStep,
      started,
    });
  }

  if (builtinId === "get_conversation_meta") {
    return invokeGetConversationMeta({
      action,
      agentId,
      conversationId,
      requestId,
      auditBase,
      auditToolRun,
      logToolStep,
      started,
    });
  }

  const durationMs = Date.now() - started;
  await auditToolRun({
    ...auditBase,
    actionId: null,
    actionVersion: action?.version ?? null,
    status: TOOL_RUN_STATUS.UNKNOWN_TOOL,
    durationMs,
    httpStatus: null,
    errorCode: "UNKNOWN_TOOL",
    errorCategory: "authz",
  });
  return withCapabilityResult({
    name: action?.name || "unknown_builtin",
    status: TOOL_RUN_STATUS.UNKNOWN_TOOL,
    durationMs,
    errorCode: "UNKNOWN_TOOL",
    resultForModel: JSON.stringify({
      ok: false,
      errorCode: "UNKNOWN_TOOL",
      message: "Unknown built-in capability",
    }),
  });
}

async function invokeRequestHandoff({
  action,
  args,
  agentId,
  conversationId,
  requestId,
  publicAccess,
  auditBase,
  auditToolRun,
  logToolStep,
  started,
}) {
  if (!conversationId) {
    const durationMs = Date.now() - started;
    await auditToolRun({
      ...auditBase,
      actionId: null,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs,
      errorCode: "HANDOFF",
      errorCategory: "desk",
    });
    return withCapabilityResult({
      name: action.name,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs,
      errorCode: "HANDOFF",
      resultForModel: JSON.stringify({
        ok: false,
        errorCode: "MISSING_CONVERSATION",
        message: "Cannot hand off without an active conversation.",
      }),
    });
  }

  const reason =
    typeof args?.reason === "string" && args.reason.trim()
      ? args.reason.trim().slice(0, 500)
      : "Assistant requested human help";
  const summary =
    typeof args?.summary === "string" && args.summary.trim()
      ? args.summary.trim().slice(0, 2000)
      : null;

  try {
    let result;
    if (publicAccess) {
      result = await triggerHandoff({
        conversationId,
        publicAgentId: agentId,
        reason,
        summary,
      });
    } else {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { userId: true },
      });
      if (!agent?.userId) {
        throw Object.assign(new Error("Agent not found"), { status: 404 });
      }
      result = await triggerHandoff({
        conversationId,
        userId: agent.userId,
        reason,
        summary,
      });
    }

    const durationMs = Date.now() - started;
    await auditToolRun({
      ...auditBase,
      actionId: null,
      actionVersion: action.version,
      status: TOOL_RUN_STATUS.OK,
      durationMs,
      httpStatus: null,
      errorCode: "HANDOFF",
      errorCategory: "desk",
    });
    logToolStep({
      requestId,
      agentId,
      conversationId,
      actionName: action.name,
      status: TOOL_RUN_STATUS.OK,
      durationMs,
      errorCode: "HANDOFF",
    });

    return withCapabilityResult({
      name: action.name,
      status: TOOL_RUN_STATUS.OK,
      durationMs,
      errorCode: "HANDOFF",
      resultForModel: JSON.stringify({
        ok: true,
        status: "escalated",
        waitingForHuman: true,
        message:
          "Handoff requested. A human teammate will continue. Tell the user briefly that help is on the way.",
      }),
      handoff: {
        triggered: true,
        ackMessage: result?.ackMessage || null,
        handoffReason: result?.handoffReason || reason,
      },
    });
  } catch (err) {
    const durationMs = Date.now() - started;
    const code = err?.details?.code || err?.code || "HANDOFF_FAILED";
    const status = err?.status || 500;
    safeLogError("builtin request_handoff failed", {
      requestId,
      agentId,
      conversationId,
      code,
      status,
    });
    await auditToolRun({
      ...auditBase,
      actionId: null,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs,
      errorCode: String(code).slice(0, 64),
      errorCategory: "desk",
    });
    return withCapabilityResult({
      name: action.name,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs,
      errorCode: status === 429 || status === 409 ? "HANDOFF" : "ERROR",
      resultForModel: JSON.stringify({
        ok: false,
        errorCode: code,
        message:
          err?.message ||
          "Could not connect to a human right now. Continue helping or ask the user to try again shortly.",
      }),
    });
  }
}

async function invokeGetConversationMeta({
  action,
  agentId,
  conversationId,
  requestId,
  auditBase,
  auditToolRun,
  logToolStep,
  started,
}) {
  if (!conversationId) {
    const durationMs = Date.now() - started;
    return withCapabilityResult({
      name: action.name,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs,
      errorCode: "ERROR",
      resultForModel: JSON.stringify({
        ok: false,
        message: "No active conversation.",
      }),
    });
  }

  const row = await prisma.conversation.findFirst({
    where: { id: conversationId, agentId },
    select: {
      id: true,
      status: true,
      aiPaused: true,
      category: true,
      sentiment: true,
      handoffAt: true,
      handoffCount: true,
    },
  });

  const durationMs = Date.now() - started;
  if (!row) {
    await auditToolRun({
      ...auditBase,
      actionId: null,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs,
      errorCode: "ERROR",
      errorCategory: "desk",
    });
    return withCapabilityResult({
      name: action.name,
      status: TOOL_RUN_STATUS.ERROR,
      durationMs,
      errorCode: "ERROR",
      resultForModel: JSON.stringify({ ok: false, message: "Conversation not found." }),
    });
  }

  const payload = {
    ok: true,
    conversationId: row.id,
    status: row.status,
    aiPaused: isAiPaused(row),
    waitingForHuman: isWaitingForHuman(row),
    category: row.category || null,
    sentiment: row.sentiment || null,
    handoffCount: row.handoffCount ?? 0,
    hasHandoffAt: Boolean(row.handoffAt),
  };

  await auditToolRun({
    ...auditBase,
    actionId: null,
    status: TOOL_RUN_STATUS.OK,
    durationMs,
    errorCode: null,
    errorCategory: null,
  });
  logToolStep({
    requestId,
    agentId,
    conversationId,
    actionName: action.name,
    status: TOOL_RUN_STATUS.OK,
    durationMs,
  });

  return withCapabilityResult({
    name: action.name,
    status: TOOL_RUN_STATUS.OK,
    durationMs,
    errorCode: null,
    resultForModel: JSON.stringify(payload),
  });
}
