import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";

export const MAX_FEEDBACK_REASON_CHARS = 200;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function sanitizeFeedbackReason(value) {
  const raw = String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return null;
  return raw.slice(0, MAX_FEEDBACK_REASON_CHARS);
}

export async function setMessageFeedback(
  messageId,
  rating,
  { agentId, reason } = {}
) {
  const value = rating === "DOWN" ? "DOWN" : "UP";
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { select: { agentId: true } } },
  });
  if (!message) throw httpError(404, "Message not found");
  if (agentId && message.conversation.agentId !== agentId) {
    throw httpError(404, "Message not found");
  }
  if (message.role !== "ASSISTANT") {
    throw httpError(400, "Only assistant replies can be rated");
  }

  const feedbackAt = new Date();
  const clearReason = value === "UP";
  const replaceReason = value === "DOWN" && typeof reason === "string";
  const feedbackReason = clearReason
    ? null
    : replaceReason
      ? sanitizeFeedbackReason(reason)
      : message.feedbackReason ?? null;

  const data = { feedback: value, feedbackAt };
  if (clearReason || replaceReason) data.feedbackReason = feedbackReason;

  try {
    return await prisma.message.update({
      where: { id: messageId },
      data,
      select: {
        id: true,
        feedback: true,
        feedbackReason: true,
        feedbackAt: true,
      },
    });
  } catch {
    if (clearReason || replaceReason) {
      await prisma.$executeRaw`
        UPDATE "Message"
        SET feedback = ${value},
            "feedbackReason" = ${feedbackReason},
            "feedbackAt" = ${feedbackAt}
        WHERE id = ${messageId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "Message"
        SET feedback = ${value},
            "feedbackAt" = ${feedbackAt}
        WHERE id = ${messageId}
      `;
    }
    return {
      id: messageId,
      feedback: value,
      feedbackReason,
      feedbackAt,
    };
  }
}

export async function listUnhelpfulRepliesForAgent(
  agentId,
  userId,
  { limit = 12 } = {}
) {
  await getAgentForUser(agentId, userId);
  const take = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const rows = await prisma.$queryRaw`
    SELECT
      m.id,
      m.content,
      m."feedbackReason",
      m."feedbackAt",
      m."createdAt",
      m."conversationId",
      c.category,
      (
        SELECT u.content
        FROM "Message" u
        WHERE u."conversationId" = m."conversationId"
          AND u.role = 'USER'
          AND u."createdAt" <= m."createdAt"
        ORDER BY u."createdAt" DESC
        LIMIT 1
      ) AS "userMessage"
    FROM "Message" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE c."agentId" = ${agentId}
      AND m.role = 'ASSISTANT'
      AND m.feedback = 'DOWN'
    ORDER BY COALESCE(m."feedbackAt", m."createdAt") DESC
    LIMIT ${take}
  `;

  const [up, down] = await Promise.all([
    prisma.message.count({
      where: {
        feedback: "UP",
        role: "ASSISTANT",
        conversation: { agentId },
      },
    }),
    prisma.message.count({
      where: {
        feedback: "DOWN",
        role: "ASSISTANT",
        conversation: { agentId },
      },
    }),
  ]);

  const rated = up + down;
  return {
    stats: {
      up,
      down,
      rated,
      helpfulPercent: rated ? Number(((up / rated) * 100).toFixed(1)) : null,
    },
    replies: (rows || []).map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      category: row.category || "GENERAL",
      assistantMessage: String(row.content || "").slice(0, 280),
      userMessage: String(row.userMessage || "").slice(0, 280),
      reason: row.feedbackReason || null,
      feedbackAt: row.feedbackAt || row.createdAt,
    })),
  };
}
