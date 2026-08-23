import prisma from "@/lib/prisma";
import { isAiPaused, matchHandoffKeyword, serializeDeskState, CONVERSATION_STATUS } from "@/lib/desk/conversation-desk";
import { getAgentForUser } from "@/lib/services/agent.service";
import { triggerHandoff } from "@/lib/services/handoff.service";
import { chatCompletion } from "@/lib/services/ai/llm.provider";
import { classifyCategoryAndSentiment } from "@/lib/services/ai/classify";
import {
  MAX_KNOWLEDGE_CHARS,
  formatClarifyQuestion,
  resolveRetrieveQuery,
  selectKnowledgeChunks,
} from "@/lib/services/ai/knowledge-retrieve";
import { buildChatSystemPrompt } from "@/lib/services/ai/prompt-builder";
import { contentForLlm } from "@/lib/utils/chat-attachments";
import { runWithRequestContext } from "@/lib/observability/request-context";
import { safeLogError } from "@/lib/observability/safe-log";
import { after } from "next/server";

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
  const isNewShape = typeof userIdOrOptions === "object" && userIdOrOptions !== null;
  const userId = isNewShape ? userIdOrOptions.userId : userIdOrOptions;
  const payload = isNewShape ? userIdOrOptions : maybePayload;
  const publicAccess = Boolean(payload?.publicAccess);
  const message = payload.message;
  const conversationId = payload.conversationId;

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
    conversation = await prisma.conversation.create({
      data: { agentId },
    });
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message,
    },
  });

  if (!isAiPaused(conversation) && publicAccess) {
    const keyword = matchHandoffKeyword(message);
    if (keyword) {
      try {
        const handoff = await triggerHandoff({
          conversationId: conversation.id,
          publicAgentId: agentId,
          reason: `Keyword: ${keyword.phrase}`,
        });
        conversation = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          include: { agent: true },
        });
        return {
          conversationId: conversation.id,
          aiPaused: true,
          waitingForHuman: true,
          handoffTriggered: true,
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
          userMessage: {
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          },
          category: conversation.category || "GENERAL",
          sentiment: conversation.sentiment || "NEUTRAL",
          ...serializeDeskState({ ...conversation, ...handoff }),
        };
      } catch (err) {
        // Cooldown / limit — keep chatting with AI instead of failing the message.
        if (err?.status !== 429 && err?.status !== 409) throw err;
      }
    }
  }

  if (isAiPaused(conversation)) {
    return {
      conversationId: conversation.id,
      aiPaused: true,
      waitingForHuman: true,
      degraded: false,
      insightsPending: false,
      usedKnowledge: [],
      message: null,
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      category: conversation.category || "GENERAL",
      sentiment: conversation.sentiment || "NEUTRAL",
      ...serializeDeskState(conversation),
    };
  }

  const [knowledgeDocs, recentMessages] = await Promise.all([
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
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
      select: { id: true, role: true, content: true },
    }),
  ]);

  // oldest → newest for the model; include the just-saved user message once
  const historyAsc = [...recentMessages].reverse();
  const llmMessages = historyAsc.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: contentForLlm(m.content),
  }));

  // Typo path: "reunf plocy" → clarify; then "yes" → retrieve with suggested topic.
  const retrieveQuery = resolveRetrieveQuery(
    contentForLlm(message),
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
  if (clarify.length) {
    const content = formatClarifyQuestion(clarify);
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content,
        responseTime: null,
      },
    });
    return {
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
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      category: conversation.category || "GENERAL",
      sentiment: conversation.sentiment || "NEUTRAL",
    };
  }

  const replyLanguage = detectKnowledgeLanguage(knowledgeDocs);
  let system;
  try {
    system = buildChatSystemPrompt({
      agent,
      knowledgeText,
      replyLanguage,
      answerStyle: agent.answerStyle,
      meta: { agentId: agent.id },
    });
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

  const {
    reply,
    degraded,
    assistantMessage,
    category,
    sentiment,
    insightsPending,
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
        const llmStarted = Date.now();
        try {
          reply = await chatCompletion({
            system,
            messages: llmMessages,
            signal,
          });
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
          reply = { content, latencyMs: null };
        }

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "ASSISTANT",
            content: reply.content,
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
          reply,
          degraded,
          assistantMessage,
          category,
          sentiment,
          insightsPending,
        };
      }
    );

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { category, sentiment },
  });

  return {
    conversationId: updated.id,
    degraded,
    insightsPending: Boolean(insightsPending),
    usedKnowledge,
    message: {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      responseTime: assistantMessage.responseTime,
      createdAt: assistantMessage.createdAt,
    },
    userMessage: {
      id: userMessage.id,
      role: userMessage.role,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    category: updated.category,
    sentiment: updated.sentiment,
  };
}
