import prisma from "@/lib/prisma";
import { getAgentForUser, resolveAgentWorkspaceAccess } from "@/lib/services/agent.service";
import { deskAccessDenial, deskPermissions } from "@/lib/desk/routing";
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
      source: c.source,
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

/**
 * Owner-only conversation view (studio, confirmations). Unchanged authority: the agent owner
 * in their active workspace.
 */
export async function getConversationForUser(id, userId) {
  return loadConversationView(id, userId, { allowTeam: false });
}

/**
 * Desk view (Level 2 · M3): the owner, or a workspace teammate (any role can read) for chats
 * that were handed to the desk. Includes the viewer's desk permissions. Never used for
 * confirmation approvals.
 */
export async function getConversationForDesk(id, userId) {
  return loadConversationView(id, userId, { allowTeam: true });
}

async function loadConversationView(id, userId, { allowTeam }) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, userId: true, workspaceId: true } },
      assignedUser: { select: { id: true, name: true } },
      qaScores: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          cxScore: true,
          grounded: true,
          resolved: true,
          tone: true,
          sentiment: true,
          issues: true,
          status: true,
          scoredAt: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          responseTime: true,
          citations: true,
          sources: true,
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

  const isOwner = conversation.agent.userId === userId;
  if (!isOwner && !allowTeam) {
    throw httpError(403, "Not allowed to access this conversation");
  }

  const workspace = await resolveActiveWorkspace(userId);
  if (conversation.agent.workspaceId !== workspace.id) {
    throw httpError(404, "Conversation not found");
  }

  let desk = { canRead: true, canReply: true, canManage: true };
  if (!isOwner) {
    const { access } = await resolveAgentWorkspaceAccess(conversation.agent, userId);
    desk = deskPermissions(access);
  }
  // Teammates see desk chats only (handed off), never every studio/embed chat.
  const denial = deskAccessDenial({ isOwner, perms: desk, handoffAt: conversation.handoffAt, need: "read" });
  if (denial) throw httpError(denial.status, denial.message);

  const { userId: _ownerId, workspaceId: _workspaceId, ...agent } =
    conversation.agent;

  return {
    id: conversation.id,
    agentId: conversation.agentId,
    source: conversation.source,
    category: conversation.category,
    sentiment: conversation.sentiment,
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt,
    createdAt: conversation.createdAt,
    ...serializeDeskState({ ...conversation, _viewerUserId: userId }),
    agent,
    messages: conversation.messages,
    qa: conversation.qaScores?.[0] || null,
    ...(allowTeam ? { desk } : {}),
  };
}
