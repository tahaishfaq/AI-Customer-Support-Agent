import prisma from "@/lib/prisma";
import { isAiPaused, matchHumanRequest, parseNeedHumanMarker, serializeDeskState, CONVERSATION_STATUS, conversationHasHumanRequest } from "@/lib/desk/conversation-desk";
import { getAgentForUser } from "@/lib/services/agent.service";
import { triggerHandoff } from "@/lib/services/handoff.service";
import { classifyCategoryAndSentiment } from "@/lib/services/ai/classify";
import {
  MAX_KNOWLEDGE_CHARS,
  formatClarifyQuestion,
  resolveRetrieveQuery,
  selectKnowledgeChunks,
} from "@/lib/services/ai/knowledge-retrieve";
import { buildChatSystemPrompt, formatDeskNotesForPrompt } from "@/lib/services/ai/prompt-builder";
import {
  listEnabledActionsForAgent,
} from "@/lib/actions/tool-loop";
import { runTurn } from "@/lib/orchestrator";
import { toolsPromptAddon } from "@/lib/actions/tool-definitions";
import { contentForLlm } from "@/lib/utils/chat-attachments";
import { runWithRequestContext } from "@/lib/observability/request-context";
import { safeLogError, safeLogInfoSampled } from "@/lib/observability/safe-log";
import { after } from "next/server";
import { streamingChatEnabled } from "@/lib/chat/sse";

const MAX_HISTORY_MESSAGES = 20;

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
      actionId: c.actionId,
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
 * Detect reply language from knowledge bases.
 * - No knowledge → English
 * - All docs same language → that language
 * - Mixed languages across docs → English (default)
 */
function detectKnowledgeLanguage(docs) {
  if (!docs?.length) return "english";

  const languages = new Set();
  for (const doc of docs) {
    languages.add(detectTextLanguage(doc.content || ""));
  }

  if (languages.size === 1) {
    return [...languages][0];
  }
  return "english";
}

function detectTextLanguage(text) {
  const sample = String(text || "").slice(0, 4000);
  if (!sample.trim()) return "english";

  const arabicScript = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (sample.match(/[A-Za-z\u0600-\u06FF]/g) || []).length || 1;
  const arabicRatio = arabicScript / letters;

  if (arabicRatio >= 0.25) return "urdu";

  const lower = sample.toLowerCase();
  const romanUrduHits = (
    lower.match(
      /\b(hai|hain|kya|kyun|nahi|nahin|aap|ap|main|mein|kaise|karo|karna|madad|shukriya|theek|bilkul|please|ji|sahab|wala|wali)\b/g
    ) || []
  ).length;
  const words = (lower.match(/\b[a-z]{2,}\b/g) || []).length || 1;
  if (romanUrduHits / words >= 0.08 && romanUrduHits >= 4) return "roman_urdu";

  return "english";
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
  const streamEmit =
    typeof payload?.stream?.emit === "function" ? payload.stream.emit : null;
  const wantStream = Boolean(streamEmit) && streamingChatEnabled();

  function emitDone(result) {
    if (wantStream && streamEmit) {
      streamEmit({ type: "done", data: result });
    }
    return result;
  }

  /** In-request only — never persisted. */
  let endUserAccessToken = null;

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

  const owner = await prisma.user.findUnique({
    where: { id: agent.userId },
    select: { role: true },
  });
  const ownerRole = owner?.role || "USER";
  const { assertConversationQuota } = await import(
    "@/lib/billing/conversation-usage.service"
  );

  function enforceConversationQuota(options) {
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
      data: { agentId },
    });
  }

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

  if (isResumeTurn) {
    const confirmation = await prisma.actionConfirmation.findFirst({
      where: {
        id: resumeAfterConfirmationId,
        conversationId: conversation.id,
        status: "APPROVED",
      },
      select: { id: true },
    });
    if (!confirmation) {
      throw httpError(400, "Confirmation not approved or not found", {
        code: "CONFIRMATION_NOT_APPROVED",
      });
    }
  }

  let userMessage = null;
  if (!isResumeTurn) {
    await enforceConversationQuota({
      conversationId: conversation.id,
      isNewConversation: false,
    });
    userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: message,
      },
    });
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

  const [knowledgeDocs, recentMessages, deskNotes, actionRuntime] =
    await Promise.all([
    prisma.knowledgeDocument.findMany({
      where: { agentId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        content: true,
        origin: true,
        sourceUrl: true,
        createdAt: true,
      },
    }),
    prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        role: { not: "INTERNAL" },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
      select: { id: true, role: true, content: true },
    }),
    prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        role: "INTERNAL",
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { content: true, createdAt: true },
    }),
    listEnabledActionsForAgent(agentId),
  ]);
  const enabledActions = actionRuntime.actions || [];
  const enabledDescriptors = actionRuntime.descriptors || [];
  const actionsWorkspaceId = actionRuntime.workspaceId || agent.workspaceId || null;
  const deskNotesText = formatDeskNotesForPrompt(deskNotes);

  const effectiveMessage =
    message ||
    [...recentMessages].reverse().find((m) => m.role === "USER")?.content ||
    "";

  // oldest → newest for the model; include the just-saved user message once
  const historyAsc = [...recentMessages].reverse();
  const llmMessages = historyAsc.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: contentForLlm(m.content),
  }));

  // Typo path: "reunf plocy" → clarify; then "yes" → retrieve with suggested topic.
  const retrieveQuery = resolveRetrieveQuery(
    contentForLlm(effectiveMessage),
    recentMessages
  );
  const selected = selectKnowledgeChunks({
    docs: knowledgeDocs,
    query: retrieveQuery,
    maxChars: MAX_KNOWLEDGE_CHARS,
    siteKnowledgeOrigin: agent.siteKnowledgeOrigin || null,
    recentMessages,
  });
  const knowledgeText = selected.text;
  const usedKnowledge = selected.used;
  const clarify = selected.clarify || [];

  // Misspelled / weak match → ask confirmation instead of answering from random docs.
  if (!isResumeTurn && clarify.length) {
    const content = formatClarifyQuestion(clarify);
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content,
        responseTime: null,
      },
    });
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

  const replyLanguage = detectKnowledgeLanguage(knowledgeDocs);
  let system;
  try {
    system = buildChatSystemPrompt({
      agent,
      knowledgeText,
      deskNotesText,
      replyLanguage,
      answerStyle: agent.answerStyle,
      meta: { agentId: agent.id },
    });
    const toolsAddon = toolsPromptAddon(enabledActions.map((a) => a.name));
    if (toolsAddon) {
      system = `${system}\n\n${toolsAddon}`;
    }
  } catch (err) {
    safeLogError("prompt-builder failed", {
      agentId,
      message: err?.message,
    });
    throw httpError(500, "Could not build agent prompt");
  }

  const SAFE_ASSISTANT =
    "Couldn't reach the AI. Your message was saved — try again in a moment.";
  const TIMEOUT_ASSISTANT =
    "The AI took too long. Your message was saved — try again.";
  const CANCEL_ASSISTANT =
    "Reply cancelled. Your message was saved — send again when ready.";

  const requestId = payload?.requestId;
  const signal = payload?.signal;
  const route = publicAccess ? "public-chat" : "studio-chat";
  // O3.1 — studio can stream even when capabilities/tools are present.
  const canTokenStream = wantStream && !publicAccess && Boolean(streamEmit);

  if (canTokenStream) {
    streamEmit({
      type: "meta",
      data: {
        conversationId: conversation.id,
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
        try {
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
            },
            flags: {
              publicAccess,
              actionsEnabled: true,
              streaming: canTokenStream,
            },
            signal,
            actions: enabledActions,
            descriptors: enabledDescriptors,
            onEvent: canTokenStream ? streamEmit : undefined,
          });
          reply = {
            content: turn.assistantText,
            latencyMs: turn.latencyMs,
            toolSteps: turn.toolSteps,
            degraded: turn.degraded,
            stopReason: turn.stopReason,
            clientActions: turn.clientActions,
          };
          toolSteps = Array.isArray(reply.toolSteps) ? reply.toolSteps : [];
        } catch (error) {
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
            code === "TIMEOUT" || error?.status === 504
              ? TIMEOUT_ASSISTANT
              : code === "ABORTED" || error?.status === 499
                ? CANCEL_ASSISTANT
                : SAFE_ASSISTANT;
          reply = { content, latencyMs: null, toolSteps: [] };
        }

        let assistantContent = reply.content;
        let needHuman = false;
        if (publicAccess && !degraded) {
          const parsed = parseNeedHumanMarker(reply.content);
          needHuman = parsed.needHuman;
          assistantContent = parsed.content;
          if (needHuman && !assistantContent) {
            assistantContent =
              "I could not fully resolve this from my knowledge. Connecting you with a teammate.";
          }
        }

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "ASSISTANT",
            content: assistantContent,
            responseTime: reply.latencyMs,
          },
        });

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
    degraded,
    insightsPending: Boolean(insightsPending),
    usedKnowledge,
    toolSteps,
    pendingConfirmations,
    identityRefreshRequired,
    handoffTriggered,
    showHandoffButton,
    message: ackMessage
      ? {
          id: ackMessage.id,
          role: ackMessage.role,
          content: ackMessage.content,
          responseTime: null,
        }
      : {
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
    category: updated.category,
    sentiment: updated.sentiment,
    ...serializeDeskState(deskConversation),
  });
}
