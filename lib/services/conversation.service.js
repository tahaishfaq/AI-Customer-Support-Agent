import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

export async function listConversationsForUser(
  userId,
  { agentId, limit = 20, offset = 0 } = {}
) {
  if (agentId) {
    await getAgentForUser(agentId, userId);
  }

  const where = {
    agent: { userId },
    ...(agentId ? { agentId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        agent: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  const conversations = rows.map((c) => ({
    id: c.id,
    agentId: c.agentId,
    category: c.category,
    sentiment: c.sentiment,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    createdAt: c.createdAt,
    messageCount: c._count.messages,
    agent: c.agent,
  }));

  return { conversations, total, limit, offset };
}

export async function getConversationForUser(id, userId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, userId: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          responseTime: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    throw httpError(404, "Conversation not found");
  }

  if (conversation.agent.userId !== userId) {
    throw httpError(403, "Not allowed to access this conversation");
  }

  const { userId: _ownerId, ...agent } = conversation.agent;

  return {
    id: conversation.id,
    agentId: conversation.agentId,
    category: conversation.category,
    sentiment: conversation.sentiment,
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt,
    createdAt: conversation.createdAt,
    agent,
    messages: conversation.messages,
  };
}
