import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";
import { chatCompletion } from "@/lib/services/ai/llm.provider";
import { classifyCategoryAndSentiment } from "@/lib/services/ai/classify";

const MAX_KNOWLEDGE_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 20;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function buildKnowledgeBlock(docs) {
  if (!docs.length) return "";

  let text = "## Agent knowledge\n";
  for (const doc of docs) {
    const chunk = `### ${doc.name} (${doc.type})\n${doc.content}\n\n`;
    if (text.length + chunk.length > MAX_KNOWLEDGE_CHARS) {
      text += "...(truncated)";
      break;
    }
    text += chunk;
  }
  return text.trim();
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

function languageLabel(code) {
  if (code === "urdu") return "Urdu (Arabic script)";
  if (code === "roman_urdu") return "Roman Urdu";
  return "English";
}

function buildSystemPrompt(agent, knowledgeText, replyLanguage) {
  const lang = languageLabel(replyLanguage);
  const rules = [
    `Reply language policy: always reply in ${lang}.`,
    "This language is chosen from the agent's knowledge bases: if every knowledge document is in one language, use that language; if there is no knowledge, or knowledge documents use mixed languages, default to English.",
    "Do not switch languages because the customer greets in another language — stay on the reply language above unless the knowledge clearly requires quoting another language.",
    "Use clear Markdown (bold, lists) when it helps readability.",
    "Answer only from the agent system prompt and knowledge. If unsure, say so.",
  ].join(" ");

  const base = `${agent.systemPrompt}\n\n## Response rules\n${rules}`;
  if (!knowledgeText) return base;
  return `${base}\n\n${knowledgeText}`;
}

/**
 * Send a user message, get AI reply, persist + classify.
 */
export async function sendChatMessage(agentId, userId, { message, conversationId }) {
  const agent = await getAgentForUser(agentId, userId);

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

    if (conversation.agent.userId !== userId) {
      throw httpError(403, "Not allowed to access this conversation");
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

  const [knowledgeDocs, recentMessages] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where: { agentId },
      orderBy: { createdAt: "asc" },
      select: { name: true, type: true, content: true },
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
    role: m.role === "ASSISTANT" ? "assistant" : "user",
    content: m.content,
  }));

  const knowledgeText = buildKnowledgeBlock(knowledgeDocs);
  const replyLanguage = detectKnowledgeLanguage(knowledgeDocs);
  const system = buildSystemPrompt(agent, knowledgeText, replyLanguage);

  let reply;
  try {
    reply = await chatCompletion({ system, messages: llmMessages });
  } catch (error) {
    // USER message already saved; do not create ASSISTANT on failure
    throw error;
  }

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: reply.content,
      responseTime: reply.latencyMs,
    },
  });

  const { category, sentiment } = await classifyCategoryAndSentiment(
    `User: ${message}\nAssistant: ${reply.content}`
  );

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { category, sentiment },
  });

  return {
    conversationId: updated.id,
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
