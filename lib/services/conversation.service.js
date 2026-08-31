import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { serializeDeskState } from "@/lib/desk/conversation-desk";

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
  const workspace = await resolveActiveWorkspace(userId);

  if (agentId) {
    await getAgentForUser(agentId, userId);
  }

  const where = {
    agent: { userId, workspaceId: workspace.id },
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  const conversations = rows.map((c) => {
    const last = c.messages[0];
    return {
      id: c.id,
      agentId: c.agentId,
      category: c.category,
      sentiment: c.sentiment,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      createdAt: c.createdAt,
      ...serializeDeskState(c),
      messageCount: c._count.messages,
      agent: c.agent,
      lastMessage: last
        ? {
            role: last.role,
            content: (last.content || "").slice(0, 140),
            createdAt: last.createdAt,
          }
        : null,
    };
  });

  return { conversations, total, limit, offset };
}

export async function getConversationForUser(id, userId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, userId: true, workspaceId: true } },
      assignedUser: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          responseTime: true,
          feedback: true,
          feedbackReason: true,
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

  const workspace = await resolveActiveWorkspace(userId);
  if (conversation.agent.workspaceId !== workspace.id) {
    throw httpError(404, "Conversation not found");
  }

  const { userId: _ownerId, workspaceId: _workspaceId, ...agent } =
    conversation.agent;

  return {
    id: conversation.id,
    agentId: conversation.agentId,
    category: conversation.category,
    sentiment: conversation.sentiment,
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt,
    createdAt: conversation.createdAt,
    ...serializeDeskState({ ...conversation, _viewerUserId: userId }),
    agent,
    messages: conversation.messages,
  };
}
