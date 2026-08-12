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

function buildSystemPrompt(agent, knowledgeText) {
  if (!knowledgeText) return agent.systemPrompt;
  return `${agent.systemPrompt}\n\n${knowledgeText}`;
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
  const system = buildSystemPrompt(agent, knowledgeText);

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
