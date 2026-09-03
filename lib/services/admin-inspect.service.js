import prisma from "@/lib/prisma";
import { getAdminConversationQuota } from "@/lib/billing/admin-conversation-quota";
import { mergeCustomization } from "@/lib/customization/defaults";
import { getDashboardForWorkspace } from "@/lib/services/analytics.service";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function toAgentCard(agent) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    enabled: agent.enabled !== false,
    embedEnabled: agent.embedEnabled !== false,
    siteKnowledgeOrigin: agent.siteKnowledgeOrigin || null,
    createdAt: agent.createdAt,
    knowledgeCount: agent._count?.knowledgeDocs ?? 0,
    conversationCount: agent._count?.conversations ?? 0,
  };
}

export async function getAdminWorkspace(workspaceId) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      _count: { select: { agents: true } },
    },
  });
  if (!workspace) {
    throw httpError(404, "Workspace not found");
  }

  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      enabled: true,
      embedEnabled: true,
      siteKnowledgeOrigin: true,
      createdAt: true,
      _count: { select: { knowledgeDocs: true, conversations: true } },
    },
  });

  const conversations =
    workspace.user.role === "ADMIN"
      ? null
      : await getAdminConversationQuota(
          workspace.user.id,
          workspace.user.role || "USER"
        );

  return {
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    user: workspace.user,
    agentCount: workspace._count.agents,
    agents: agents.map(toAgentCard),
    conversations,
  };
}

export async function getAdminWorkspaceDashboard(workspaceId, { range, agentId } = {}) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) throw httpError(404, "Workspace not found");
  return getDashboardForWorkspace(workspaceId, { range, agentId });
}

export async function getAdminAgent(agentId) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      knowledgeDocs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          fileUrl: true,
          sourceUrl: true,
          origin: true,
          createdAt: true,
        },
      },
      conversations: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, startedAt: true },
      },
      _count: { select: { conversations: true } },
    },
  });
  if (!agent) throw httpError(404, "Agent not found");

  const lastChat = agent.conversations[0] || null;

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    welcomeMessage: agent.welcomeMessage,
    enabled: agent.enabled !== false,
    embedEnabled: agent.embedEnabled !== false,
    publicKey: agent.publicKey,
    customization: mergeCustomization(agent.customization),
    siteKnowledgeOrigin: agent.siteKnowledgeOrigin,
    siteCrawledAt: agent.siteCrawledAt,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    conversationCount: agent._count.conversations,
    lastChatAt: lastChat?.startedAt || null,
    lastChatId: lastChat?.id || null,
    workspace: {
      id: agent.workspace.id,
      name: agent.workspace.name,
      userId: agent.workspace.userId,
    },
    user: agent.workspace.user,
    knowledge: agent.knowledgeDocs,
  };
}

export async function setAdminAgentEnabled(agentId, enabled) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw httpError(404, "Agent not found");
  return prisma.agent.update({
    where: { id: agentId },
    data: { enabled: Boolean(enabled) },
    select: {
      id: true,
      name: true,
      enabled: true,
      embedEnabled: true,
    },
  });
}

export async function setAdminAgentEmbedEnabled(agentId, embedEnabled) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw httpError(404, "Agent not found");
  return prisma.agent.update({
    where: { id: agentId },
    data: { embedEnabled: Boolean(embedEnabled) },
    select: {
      id: true,
      name: true,
      enabled: true,
      embedEnabled: true,
    },
  });
}

function mapConversationRow(c) {
  const last = c.messages[0];
  return {
    id: c.id,
    agentId: c.agentId,
    category: c.category,
    sentiment: c.sentiment,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    createdAt: c.createdAt,
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
}

export async function listAdminConversations(agentId, { limit = 20, offset = 0 } = {}) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true },
  });
  if (!agent) throw httpError(404, "Agent not found");

  const where = { agentId };
  const take = Math.min(50, Math.max(1, Number(limit) || 20));
  const skip = Math.max(0, Number(offset) || 0);

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take,
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

  return {
    conversations: rows.map(mapConversationRow),
    total,
    limit: take,
    offset: skip,
  };
}

export async function getAdminConversation(id) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          userId: true,
          workspaceId: true,
          workspace: {
            select: {
              id: true,
              name: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          responseTime: true,
          feedback: true,
          createdAt: true,
        },
      },
    },
  });
  if (!conversation) throw httpError(404, "Conversation not found");

  return {
    id: conversation.id,
    agentId: conversation.agentId,
    category: conversation.category,
    sentiment: conversation.sentiment,
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt,
    createdAt: conversation.createdAt,
    agent: {
      id: conversation.agent.id,
      name: conversation.agent.name,
    },
    workspace: conversation.agent.workspace,
    user: conversation.agent.workspace.user,
    messages: conversation.messages,
  };
}
