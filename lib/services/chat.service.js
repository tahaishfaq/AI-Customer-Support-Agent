import prisma from "@/lib/prisma";
import { createActivityStream } from "@/lib/chat/activity-emitter";
import { isAiPaused, matchHumanRequest, parseNeedHumanMarker, serializeDeskState, CONVERSATION_STATUS, conversationHasHumanRequest } from "@/lib/desk/conversation-desk";
import { getAgentForUser } from "@/lib/services/agent.service";
import { triggerHandoff } from "@/lib/services/handoff.service";
import { classifyCategoryAndSentiment } from "@/lib/services/ai/classify";
import { formatClarifyQuestion } from "@/lib/services/ai/knowledge-retrieve";
import { buildAgentTurnContext } from "@/lib/services/ai/turn-context";
import { runTurn } from "@/lib/orchestrator";
import { runWithRequestContext } from "@/lib/observability/request-context";
import { safeLogError, safeLogInfoSampled } from "@/lib/observability/safe-log";
import { after } from "next/server";
import { streamingChatEnabled } from "@/lib/chat/sse";
import { enqueueRealtimeEvent } from "@/lib/realtime/outbox";
import {
  createPublicConversationAccess,
  verifyPublicConversationAccess,
} from "@/lib/realtime/public-access.service";
import { REALTIME_EVENT_TYPES, REALTIME_VISIBILITIES } from "@/lib/realtime/constants";
import { createTurnRun, finishTurnRun, touchTurnRun } from "@/lib/services/turn-run.service";

/** Default on — classify after HTTP return (insights lag one beat). Set CLASSIFY_AFTER_RETURN=0 for sync. */
function classifyAfterReturnEnabled() {
  return process.env.CLASSIFY_AFTER_RETURN !== "0";
}

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

/** Handoff is best-effort — rate limits and duplicate requests should not fail chat. */
async function tryTriggerHandoff(params) {
  try {
    return await triggerHandoff(params);
  } catch (err) {
    if (err?.status !== 429 && err?.status !== 409) throw err;
    return null;
  }
}

async function persistChatMessageWithEvent({
  conversationId,
  agentId,
  userId,
  workspaceId,
  publicAccess,
  role,
  content,
  responseTime = null,
  citations = null,
  sources = null,
  quotaOwnerRole = "USER",
  expectedRealtimeVersion = null,
  clientMessageId = null,
}) {
  return prisma.$transaction(async (tx) => {
    const updateResult = await tx.conversation.updateMany({
      where: {
        id: conversationId,
        ...(expectedRealtimeVersion == null
          ? {}
          : { realtimeVersion: expectedRealtimeVersion }),
      },
      data: { realtimeVersion: { increment: 1 } },
    });
    if (updateResult.count !== 1) {
      const error = new Error("Conversation ownership changed");
      error.code = "CONVERSATION_OWNERSHIP_CHANGED";
      throw error;
    }
    const updatedConversation = await tx.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, realtimeVersion: true },
    });
    const message = await tx.message.create({
      data: {
        conversationId,
        ...(clientMessageId ? { clientMessageId } : {}),
        role,
        content,
        responseTime,
        ...(Array.isArray(citations) && citations.length ? { citations } : {}),
        ...(Array.isArray(sources) && sources.length ? { sources } : {}),
      },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.MESSAGE_CREATED,
      visibility: publicAccess
        ? REALTIME_VISIBILITIES.BOTH
        : REALTIME_VISIBILITIES.OWNER,
      userId: userId || null,
      workspaceId: workspaceId || null,
      agentId,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updatedConversation.realtimeVersion,
      payload: {
        messageId: message.id,
        role: message.role,
        content: message.content,
        responseTime: message.responseTime,
        ...(message.citations ? { citations: message.citations } : {}),
        ...(message.sources ? { sources: message.sources } : {}),
        createdAt: message.createdAt,
      },
    });
    if (publicAccess && role === "USER") {
      const userMessageCount = await tx.message.count({
        where: { conversationId, role: "USER" },
      });
      if (userMessageCount === 2) {
        const { getQuotaRealtimePayload } = await import(
          "@/lib/billing/conversation-usage.service"
        );
        const quota = await getQuotaRealtimePayload(
          tx,
          userId,
          quotaOwnerRole
        );
        await enqueueRealtimeEvent(tx, {
          eventType: REALTIME_EVENT_TYPES.BILLING_QUOTA_UPDATED,
          visibility: REALTIME_VISIBILITIES.OWNER,
          userId: userId || null,
          agentId,
          aggregateType: "conversation-quota",
          aggregateVersion: updatedConversation.realtimeVersion,
          payload: quota,
        });
      }
    }
    return { message, realtimeVersion: updatedConversation.realtimeVersion };
  });
}

/** Dedupe pending confirmations from tool steps (F14-A). */
function collectPendingConfirmations(toolSteps = []) {
  const seen = new Set();
  const out = [];
  for (const step of toolSteps) {
    const c = step?.pendingConfirmation;
    if (!c?.id || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({
      id: c.id,
      conversationId: c.conversationId,
      actionId: c.actionId || null,
      mcpToolId: c.mcpToolId || null,
      actionName: c.actionName || step.name || null,
      actionDescription: c.actionDescription || null,
      args: c.args && typeof c.args === "object" ? c.args : {},
      argsHash: c.argsHash || null,
      status: c.status || "PENDING",
      expiresAt: c.expiresAt || null,
    });
  }
  return out;
}

/**
 * Send a user message, get AI reply, persist + classify.
 * @param {string} agentId
 * @param {{ userId?: string, publicAccess?: boolean, message: string, conversationId?: string }}
 */
export async function sendChatMessage(agentId, userIdOrOptions, maybePayload) {
  const chatStarted = Date.now();
  const isNewShape = typeof userIdOrOptions === "object" && userIdOrOptions !== null;
  const userId = isNewShape ? userIdOrOptions.userId : userIdOrOptions;
  const payload = isNewShape ? userIdOrOptions : maybePayload;
  const publicAccess = Boolean(payload?.publicAccess);
  const message = payload.message;
  const resumeAfterConfirmationId = payload.resumeAfterConfirmationId || null;
  const isResumeTurn = Boolean(resumeAfterConfirmationId);
  const conversationId = payload.conversationId;
  const identityToken =
    payload.identityToken ||
    payload.customerIdentity ||
    null;
  const userSession = payload.userSession || null;
  const bearerToken = payload.bearerToken || null;
  const requestOrigin = payload.requestOrigin || null;
  const realtimeAccessToken = payload.realtimeAccessToken || null;
  const clientMessageId = payload.clientMessageId || null;
  const streamEmit =
    typeof payload?.stream?.emit === "function" ? createActivityStream(payload.stream.emit) : null;
  const wantStream = Boolean(streamEmit) && streamingChatEnabled();
  let activeTurnRunId = null;

  async function emitDone(result) {
    if (activeTurnRunId) {
      await finishTurnRun(activeTurnRunId, {
        status: result?.handoffTriggered || result?.aiPaused
          ? "ESCALATED"
          : result?.degraded
            ? "FAILED"
            : "COMPLETED",
        errorCode: result?.degraded ? result?.degradedCode || "LLM_FAILED" : null,
      }).catch(() => null);
    }
    if (wantStream && streamEmit) {
      streamEmit({ type: "done", data: result });
    }
    return result;
  }

  /** In-request only — never persisted. */
  let endUserAccessToken = null;
  /** @type {{ email?: string|null, phone?: string|null }|null} */
  let customerClaims = null;

  let agent;
  if (publicAccess) {
    agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.embedEnabled === false || agent.enabled === false) {
      throw httpError(404, "Agent not found");
    }
    const { getPlatformSettings } = await import(
      "@/lib/services/platform-settings.service"
    );
    const settings = await getPlatformSettings();
    if (settings.globalEmbedKill) {
      throw httpError(404, "Agent not found");
    }
  } else {
    agent = await getAgentForUser(agentId, userId);
    if (agent.enabled === false) {
      throw httpError(403, "This agent is disabled");
    }
  }

  let publicRealtimeAccessToken = null;

  const owner = await prisma.user.findUnique({
    where: { id: agent.userId },
    select: { role: true },
  });
  const ownerRole = owner?.role || "USER";
  const { assertConversationQuota } = await import(
    "@/lib/billing/conversation-usage.service"
  );

  // Studio / owner test chat never consumes monthly conversation quota.
  function enforceConversationQuota(options) {
    if (!publicAccess) return Promise.resolve(null);
    try {
      return assertConversationQuota(agent.userId, ownerRole, options);
    } catch (err) {
      if (err?.code === "conversation_limit_reached") {
        throw httpError(err.status || 402, err.message, {
          code: err.code,
          quota: err.quota,
        });
      }
      throw err;
    }
  }

  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { agent: true },
    });

    if (!conversation) {
      throw httpError(404, "Conversation not found");
    }

    if (conversation.agentId !== agentId) {
      throw httpError(404, "Conversation not found");
    }

    if (!publicAccess && conversation.agent.userId !== userId) {
      throw httpError(403, "Not allowed to access this conversation");
    }

    if (conversation.status === CONVERSATION_STATUS.RESOLVED) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status: CONVERSATION_STATUS.OPEN,
          endedAt: null,
          aiPaused: false,
        },
        include: { agent: true },
      });
    }
  } else {
    await enforceConversationQuota({ isNewConversation: true });
    conversation = await prisma.conversation.create({
      data: {
        agentId,
        source: publicAccess ? "EMBED" : "STUDIO",
      },
    });
  }

  if (!isResumeTurn && clientMessageId) {
    const turnRun = await createTurnRun({
      agentId,
      conversationId: conversation.id,
      workspaceId: agent.workspaceId,
      clientMessageId,
      requestId: payload.requestId || null,
      ownershipVersion: conversation.realtimeVersion,
    });
    activeTurnRunId = turnRun?.id || null;
    await touchTurnRun(activeTurnRunId, "RUNNING").catch(() => null);
  }

  streamEmit?.setContext?.({ conversationId: conversation.id });

  // F11-R2 / F14-C: attach verified customer subject (+ optional end-user access token)
  if (identityToken || userSession || bearerToken) {
    try {
      const { resolveEndUserIdentity } = await import(
        "@/lib/actions/identity"
      );
      const identity = resolveEndUserIdentity({
        identityToken,
        bearerToken,
        userSession,
      });
      if (identity?.sub) {
        endUserAccessToken = identity.accessToken || null;
        customerClaims = {
          email: identity.email || null,
          phone: identity.phone || null,
        };
        const { resolveIdentityExpiresAt } = await import(
          "@/lib/actions/identity-ttl"
        );
        conversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            customerSubject: identity.sub,
            identityIss: identity.iss ?? null,
            identityExpiresAt: resolveIdentityExpiresAt(identity),
          },
          include: { agent: true },
        });
      }
    } catch (err) {
      if (err?.code === "IDENTITY_SECRET_MISSING") {
        safeLogError("identity secret missing", { agentId });
      } else if (
        err?.code === "IDENTITY_INVALID" ||
        err?.code === "IDENTITY_EXPIRED" ||
        err?.code === "IDENTITY_REQUIRED"
      ) {
        throw httpError(401, err.message || "Invalid identity token", {
          code: err.code,
        });
      } else {
        throw err;
      }
    }
  }

  if (publicAccess) {
    const existingAccess = await prisma.publicConversationAccess.findFirst({
      where: {
        conversationId: conversation.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!existingAccess) {
      const access = await createPublicConversationAccess({
        conversationId: conversation.id,
        customerSubject: conversation.customerSubject,
        origin: requestOrigin,
      });
      publicRealtimeAccessToken = access.rawToken;
    } else if (
      !(await verifyPublicConversationAccess({
        rawToken: realtimeAccessToken,
        conversationId: conversation.id,
        agentId,
        origin: requestOrigin,
        customerSubject: conversation.customerSubject,
      }))
    ) {
      throw httpError(401, "Public conversation access denied", {
        code: "PUBLIC_CONVERSATION_ACCESS_REQUIRED",
      });
    }
  }

  // F14-E — refuse stale identity session for this turn (host must setUser again).
  let identityRefreshRequired = false;
  {
    const { isConversationIdentityExpired } = await import(
      "@/lib/actions/identity-ttl"
    );
    if (isConversationIdentityExpired(conversation)) {
      identityRefreshRequired = true;
      endUserAccessToken = null;
      if (conversation.customerSubject) {
        conversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            customerSubject: null,
            identityIss: null,
            identityExpiresAt: null,
          },
          include: { agent: true },
        });
      }
    }
  }

  try {
    const { expireStalePendingConfirmations } = await import(
      "@/lib/services/confirmation.service"
    );
    await expireStalePendingConfirmations(conversation.id);
  } catch {
    // non-fatal
  }

  let resumeActionName = null;
  if (isResumeTurn) {
    const confirmation = await prisma.actionConfirmation.findFirst({
      where: {
        id: resumeAfterConfirmationId,
        conversationId: conversation.id,
        status: "APPROVED",
      },
      select: {
        id: true,
        action: { select: { name: true } },
        mcpTool: { select: { functionName: true } },
      },
    });
    if (!confirmation) {
      throw httpError(400, "Confirmation not approved or not found", {
        code: "CONFIRMATION_NOT_APPROVED",
      });
    }
    resumeActionName =
      confirmation.action?.name ||
      confirmation.mcpTool?.functionName ||
      null;
  }

  let userMessage = null;
  let expectedRealtimeVersion = conversation.realtimeVersion;
  if (!isResumeTurn) {
    if (clientMessageId) {
      const existingUserMessage = await prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          role: "USER",
          clientMessageId,
        },
        orderBy: { createdAt: "asc" },
      });
      if (existingUserMessage) {
        const existingAssistantMessage = await prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            role: "ASSISTANT",
            createdAt: { gt: existingUserMessage.createdAt },
          },
          orderBy: { createdAt: "asc" },
        });
        return emitDone({
          conversationId: conversation.id,
          ...(publicRealtimeAccessToken
            ? { realtimeAccessToken: publicRealtimeAccessToken }
            : {}),
          replayed: true,
          degraded: false,
          insightsPending: false,
          usedKnowledge: [],
          message: existingAssistantMessage
            ? {
                id: existingAssistantMessage.id,
                role: existingAssistantMessage.role,
                content: existingAssistantMessage.content,
                responseTime: existingAssistantMessage.responseTime,
                citations: existingAssistantMessage.citations || [],
                sources: existingAssistantMessage.sources || [],
                createdAt: existingAssistantMessage.createdAt,
              }
            : null,
          userMessage: {
            id: existingUserMessage.id,
            role: existingUserMessage.role,
            content: existingUserMessage.content,
            createdAt: existingUserMessage.createdAt,
          },
          category: conversation.category || "GENERAL",
          sentiment: conversation.sentiment || "NEUTRAL",
          ...serializeDeskState(conversation),
        });
      }
    }
    await enforceConversationQuota({
      conversationId: conversation.id,
      isNewConversation: false,
    });
    const persisted = await persistChatMessageWithEvent({
      conversationId: conversation.id,
      agentId,
      userId: agent.userId,
      workspaceId: agent.workspaceId,
      publicAccess,
      role: "USER",
      content: message,
        quotaOwnerRole: ownerRole,
        clientMessageId,
    });
    userMessage = persisted.message;
    expectedRealtimeVersion = persisted.realtimeVersion;
  }

  if (!isResumeTurn && !isAiPaused(conversation) && publicAccess) {
    const humanAsk = matchHumanRequest(message);
    if (humanAsk) {
      const userTurns = await prisma.message.findMany({
        where: { conversationId: conversation.id, role: "USER" },
        select: { content: true },
      });
      const askCount = userTurns.filter((row) =>
        matchHumanRequest(row.content)
      ).length;
      // Second explicit ask in this chat → connect. First ask → AI tries first.
      if (askCount >= 2) {
        const handoff = await tryTriggerHandoff({
          conversationId: conversation.id,
          publicAgentId: agentId,
          reason: `Customer insisted: ${humanAsk.phrase}`,
        });
        if (handoff) {
          conversation = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            include: { agent: true },
          });
          return emitDone({
            conversationId: conversation.id,
            ...(publicRealtimeAccessToken
              ? { realtimeAccessToken: publicRealtimeAccessToken }
              : {}),
            aiPaused: true,
            waitingForHuman: true,
            handoffTriggered: true,
            showHandoffButton: false,
            handoffReason: handoff.handoffReason,
            degraded: false,
            insightsPending: false,
            usedKnowledge: [],
            message: handoff.ackMessage
              ? {
                  id: handoff.ackMessage.id,
                  role: handoff.ackMessage.role,
                  content: handoff.ackMessage.content,
                  responseTime: null,
                }
              : null,
            userMessage: userMessage
              ? {
                  id: userMessage.id,
                  role: userMessage.role,
                  content: userMessage.content,
                  createdAt: userMessage.createdAt,
                }
              : null,
            category: conversation.category || "GENERAL",
            sentiment: conversation.sentiment || "NEUTRAL",
            ...serializeDeskState({ ...conversation, ...handoff }),
          });
        }
      }
    }
  }

  if (isAiPaused(conversation)) {
    return emitDone({
      conversationId: conversation.id,
      ...(publicRealtimeAccessToken
        ? { realtimeAccessToken: publicRealtimeAccessToken }
        : {}),
      aiPaused: true,
      waitingForHuman: true,
      showHandoffButton: false,
      degraded: false,
      insightsPending: false,
      usedKnowledge: [],
      message: null,
      userMessage: userMessage
        ? {
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          }
        : null,
      category: conversation.category || "GENERAL",
      sentiment: conversation.sentiment || "NEUTRAL",
      ...serializeDeskState(conversation),
    });
  }

  const turnContext = await buildAgentTurnContext({
    agent,
    conversationId: conversation.id,
    message,
    onKnowledgeActivity:
      wantStream && streamEmit
        ? (event) => {
            streamEmit(event);
          }
        : null,
  });

  const {
    effectiveMessage,
    llmMessages,
    recentMessages,
    usedKnowledge,
    knowledgeEvidence,
    clarify,
    enabledActions: turnEnabledActions,
    enabledDescriptors: turnEnabledDescriptors,
    actionsWorkspaceId,
    suppressedPublicReadNames,
    systemPrompt: baseSystem,
  } = turnContext;

  let enabledActions = turnEnabledActions;
  let enabledDescriptors = turnEnabledDescriptors;
  let system = baseSystem;

  // After Approve: force the confirmed tool — do not let the model escape to handoff.
  if (isResumeTurn && resumeActionName) {
    const blockHandoff = (list) =>
      (Array.isArray(list) ? list : []).filter(
        (a) => String(a?.name || "").toLowerCase() !== "request_handoff"
      );
    enabledActions = blockHandoff(enabledActions);
    enabledDescriptors = blockHandoff(enabledDescriptors);
    system = `${system}\n\n## Confirmation resume (server)\nThe visitor approved the pending confirmation for tool \`${resumeActionName}\`. Call \`${resumeActionName}\` now with the same arguments from their last request. Do not call request_handoff. Do not ask for confirmation again. After the tool succeeds, briefly confirm the outcome.`;
  }

  // Misspelled / weak match → ask confirmation instead of answering from random docs.
  if (!isResumeTurn && clarify.length) {
    const content = formatClarifyQuestion(clarify);
    const assistantMessage = (
      await persistChatMessageWithEvent({
        conversationId: conversation.id,
        agentId,
        userId: agent.userId,
        workspaceId: agent.workspaceId,
        publicAccess,
        role: "ASSISTANT",
        content,
        expectedRealtimeVersion,
      })
    ).message;
    if (wantStream && streamEmit) {
      streamEmit({
        type: "meta",
        data: {
          conversationId: conversation.id,
          ...(userMessage?.id ? { userMessageId: userMessage.id } : {}),
        },
      });
    }
    return emitDone({
      conversationId: conversation.id,
      ...(publicRealtimeAccessToken
        ? { realtimeAccessToken: publicRealtimeAccessToken }
        : {}),
      degraded: false,
      insightsPending: false,
      usedKnowledge: [],
      clarify,
      message: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        responseTime: assistantMessage.responseTime,
        createdAt: assistantMessage.createdAt,
      },
      userMessage: userMessage
        ? {
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          }
        : null,
      category: conversation.category || "GENERAL",
      sentiment: conversation.sentiment || "NEUTRAL",
      showHandoffButton: Boolean(
        publicAccess && matchHumanRequest(effectiveMessage)
      ),
      ...serializeDeskState(conversation),
    });
  }

  const SAFE_ASSISTANT =
    "Couldn't reach the AI. Your message was saved — try again in a moment.";
  const CREDIT_ASSISTANT =
    "AI credits are unavailable. Add credits or configure a funded OpenAI API key, then try again.";
  const NOT_CONFIGURED_ASSISTANT =
    "AI is not configured. Add OPENAI_API_KEY on the server, then try again.";
  const TIMEOUT_ASSISTANT =
    "The AI took too long. Your message was saved — try again.";
  const CANCEL_ASSISTANT =
    "Response interrupted. Check the conversation and action status before trying again; an action may already have completed.";

  const requestId = payload?.requestId;
  const signal = payload?.signal;
  const route = publicAccess ? "public-chat" : "studio-chat";
  // O3.1 — studio can stream even when capabilities/tools are present.
  const canTokenStream = wantStream && Boolean(streamEmit);

  if (canTokenStream) {
    streamEmit({
      type: "meta",
      data: {
        conversationId: conversation.id,
        ...(publicAccess && publicRealtimeAccessToken
          ? { realtimeAccessToken: publicRealtimeAccessToken }
          : {}),
        ...(userMessage?.id ? { userMessageId: userMessage.id } : {}),
      },
    });
  }

  const {
    reply,
    degraded,
    assistantMessage,
    category,
    sentiment,
    insightsPending,
    needHuman = false,
    toolSteps = [],
  } = await runWithRequestContext(
    {
      requestId,
      agentId,
      conversationId: conversation.id,
      route,
    },
    async () => {
        let reply;
        let degraded = false;
        let toolSteps = [];
        const llmStarted = Date.now();
        let preparing = Boolean(canTokenStream);
        const finishPreparation = (phase = "completed") => {
          if (!preparing) return;
          preparing = false;
          streamEmit({ type: "tool", data: { kind: "agent_activity", activityId: "response-preparation", mode: "preparation", phase } });
        };
        try {
          if (preparing) streamEmit({ type: "tool", data: { kind: "agent_activity", activityId: "response-preparation", mode: "preparation", phase: "running" } });
          // Unified path: Orchestrator owns the loop; streams final text when enabled.
          const turn = await runTurn({
            requestId,
            agentId,
            workspaceId: actionsWorkspaceId,
            conversationId: conversation.id,
            channel: publicAccess ? "embed" : "studio",
            userMessage: effectiveMessage,
            history: llmMessages,
            systemPrompt: system,
            identity: {
              customerSubject: conversation.customerSubject || null,
              endUserAccessToken,
              customerClaims,
            },
            flags: {
              publicAccess,
              actionsEnabled: Boolean(agent.actionsEnabled),
              streaming: canTokenStream,
            },
            signal,
            actions: enabledActions,
            descriptors: enabledDescriptors,
            suppressedPublicReadNames: [...suppressedPublicReadNames],
            onEvent: canTokenStream ? (event) => {
              if (event.type === "tool" || event.type === "delta") finishPreparation();
              streamEmit(event);
            } : undefined,
          });
          finishPreparation();
          reply = {
            content: turn.assistantText,
            latencyMs: turn.latencyMs,
            toolSteps: turn.toolSteps,
            degraded: turn.degraded,
            stopReason: turn.stopReason,
            clientActions: turn.clientActions,
            citations: turn.citations || [],
            sources: turn.sources || [],
            searchActions: turn.searchActions || [],
            responseId: turn.responseId || null,
            searchUsed: Boolean(turn.searchUsed),
          };
          toolSteps = Array.isArray(reply.toolSteps) ? reply.toolSteps : [];
        } catch (error) {
          finishPreparation(signal?.aborted ? "cancelled" : "failed");
          const code = error?.details?.code || error?.code;
          safeLogError("chatCompletion failed", {
            requestId,
            agentId,
            conversationId: conversation.id,
            route,
            durationMs: Date.now() - llmStarted,
            code: code || "LLM_FAILED",
          });
          degraded = true;
          // Always persist an assistant row so the USER message is never orphaned.
          const content =
            code === "credit_balance_exhausted"
              ? CREDIT_ASSISTANT
              : code === "ai_not_configured"
                ? NOT_CONFIGURED_ASSISTANT
                : code === "TIMEOUT" || error?.status === 504
              ? TIMEOUT_ASSISTANT
              : code === "ABORTED" || error?.status === 499
                ? CANCEL_ASSISTANT
                : SAFE_ASSISTANT;
          reply = { content, latencyMs: null, toolSteps: [], degradedCode: code || "LLM_FAILED" };
        }

        let assistantContent = reply.content;
        let needHuman = false;
        // Strip [[NEED_HUMAN]] for all channels; only public embed uses it for auto-handoff.
        {
          const parsed = parseNeedHumanMarker(reply.content);
          needHuman = parsed.needHuman;
          assistantContent = parsed.content || assistantContent;
          if (publicAccess && needHuman && !assistantContent) {
            assistantContent =
              "I could not fully resolve this from my knowledge. Connecting you with a teammate.";
          }
        }

        // Tools (e.g. request_handoff) may bump realtimeVersion mid-turn.
        // Refresh before the assistant persist or ownership check fails → 500.
        if (Array.isArray(toolSteps) && toolSteps.length > 0) {
          const fresh = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            select: { realtimeVersion: true },
          });
          if (fresh?.realtimeVersion != null) {
            expectedRealtimeVersion = fresh.realtimeVersion;
          }
        }

        const handoffAckFromTools =
          toolSteps.find((s) => s?.handoff?.triggered)?.handoff?.ackMessage ||
          null;
        const trimmedAssistant = String(assistantContent || "").trim();
        const skipDuplicateHandoffPersist =
          handoffAckFromTools &&
          (!trimmedAssistant ||
            trimmedAssistant ===
              String(handoffAckFromTools.content || "").trim());

        let assistantMessage = handoffAckFromTools;
        if (!skipDuplicateHandoffPersist) {
          assistantMessage = (
            await persistChatMessageWithEvent({
              conversationId: conversation.id,
              agentId,
              userId: agent.userId,
              workspaceId: agent.workspaceId,
              publicAccess,
              role: "ASSISTANT",
              content:
                trimmedAssistant ||
                "A human teammate will continue this conversation.",
              responseTime: reply.latencyMs,
              citations: reply.citations,
              sources: reply.sources,
              expectedRealtimeVersion,
            })
          ).message;
        }

        let category = "GENERAL";
        let sentiment = "NEUTRAL";
        let insightsPending = false;

        if (!degraded) {
          if (classifyAfterReturnEnabled()) {
            // Return reply first; classify in after() so TTFT is not +0.5–2s.
            insightsPending = true;
            const classifyText = `User: ${message}\nAssistant: ${reply.content}`;
            const convId = conversation.id;
            after(async () => {
              try {
                const labeled = await classifyCategoryAndSentiment(classifyText, {
                  requestId,
                  agentId,
                  conversationId: convId,
                });
                await prisma.conversation.update({
                  where: { id: convId },
                  data: {
                    category: labeled.category,
                    sentiment: labeled.sentiment,
                  },
                });
              } catch (error) {
                safeLogError("after-return classify failed", {
                  requestId,
                  agentId,
                  conversationId: convId,
                  code: error?.code || "CLASSIFY_AFTER_FAIL",
                });
              }
            });
          } else {
            const labeled = await classifyCategoryAndSentiment(
              `User: ${message}\nAssistant: ${reply.content}`,
              { requestId, agentId, conversationId: conversation.id }
            );
            category = labeled.category;
            sentiment = labeled.sentiment;
          }
        }

        return {
          reply: { ...reply, content: assistantContent },
          degraded,
          citations: reply.citations || [],
          sources: reply.sources || [],
          searchActions: reply.searchActions || [],
          responseId: reply.responseId || null,
          searchUsed: Boolean(reply.searchUsed),
          assistantMessage,
          category,
          sentiment,
          insightsPending,
          needHuman,
          toolSteps: toolSteps.map((s) => ({
            name: s.name,
            status: s.status,
            httpStatus: s.httpStatus,
            durationMs: s.durationMs,
            errorCode: s.errorCode,
            errorCategory: s.errorCategory || null,
            requestId: requestId || null,
            ...(s.pendingConfirmation
              ? { pendingConfirmation: s.pendingConfirmation }
              : {}),
            ...(s.capabilityResult
              ? { capabilityResult: s.capabilityResult }
              : {}),
            ...(s.evidence ? { evidence: s.evidence } : {}),
            ...(s.handoff ? { handoff: s.handoff } : {}),
          })),
        };
      }
    );
  const pendingConfirmations = collectPendingConfirmations(toolSteps);

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { category, sentiment },
  });

  let deskConversation = updated;
  let handoffTriggered = false;
  let ackMessage = null;

  const toolEscalated = toolSteps.some(
    (s) =>
      s?.errorCode === "HANDOFF" ||
      s?.capabilityResult?.status === "escalate" ||
      s?.handoff?.triggered
  );

  if (toolEscalated) {
    handoffTriggered = true;
    const handoffStep = toolSteps.find((s) => s?.handoff?.triggered);
    ackMessage = handoffStep?.handoff?.ackMessage || null;
    deskConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
    });
  } else if (publicAccess && !degraded && needHuman) {
    const handoff = await tryTriggerHandoff({
      conversationId: conversation.id,
      publicAgentId: agentId,
      reason: "AI could not resolve from knowledge",
    });
    if (handoff) {
      handoffTriggered = true;
      ackMessage = handoff.ackMessage || null;
      deskConversation = await prisma.conversation.findUnique({
        where: { id: conversation.id },
      });
    }
  }

  const showHandoffButton =
    publicAccess &&
    !handoffTriggered &&
    !isAiPaused(deskConversation) &&
    (Boolean(needHuman) ||
      conversationHasHumanRequest(recentMessages) ||
      Boolean(matchHumanRequest(effectiveMessage)));

  if (!degraded) {
    safeLogInfoSampled("chat completed", {
      requestId,
      agentId,
      conversationId: updated.id,
      route,
      durationMs: Date.now() - chatStarted,
      stopReason: reply?.stopReason || (toolEscalated ? "escalate" : "final"),
      toolStepCount: Array.isArray(toolSteps) ? toolSteps.length : 0,
      code: "CHAT_OK",
    });
  }

  return emitDone({
    conversationId: updated.id,
    ...(publicRealtimeAccessToken
      ? { realtimeAccessToken: publicRealtimeAccessToken }
      : {}),
    degraded,
    degradedCode: degraded ? reply?.degradedCode || "LLM_FAILED" : null,
    citations: reply?.citations || [],
    sources: reply?.sources || [],
    searchActions: reply?.searchActions || [],
    responseId: reply?.responseId || null,
    searchUsed: Boolean(reply?.searchUsed),
    insightsPending: Boolean(insightsPending),
    ...(publicAccess ? {} : { usedKnowledge }),
    ...(publicAccess ? {} : { knowledgeEvidence }),
    toolSteps,
    pendingConfirmations,
    identityRefreshRequired,
    handoffTriggered,
    showHandoffButton,
    message: (() => {
      const out = ackMessage || assistantMessage;
      if (!out?.id) return null;
      return {
        id: out.id,
        role: out.role,
        content: out.content,
        responseTime: ackMessage ? null : out.responseTime ?? null,
        ...(out.citations ? { citations: out.citations } : {}),
        ...(out.sources ? { sources: out.sources } : {}),
        ...(out.createdAt ? { createdAt: out.createdAt } : {}),
      };
    })(),
    userMessage: userMessage
      ? {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        }
      : null,
    category: updated.category,
    sentiment: updated.sentiment,
    ...serializeDeskState(deskConversation),
  });
}
