import prisma from "@/lib/prisma";
import {
  CONVERSATION_STATUS,
  DESK_HANDOFF_ACK_MESSAGE,
  canActAsHuman,
  evaluateHandoffEligibility,
  isWaitingForHuman,
  serializeDeskState,
} from "@/lib/desk/conversation-desk";
import { DESK_WAITING_SOFT_CAP } from "@/lib/desk/desk-config";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { safeLogError } from "@/lib/observability/safe-log";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

async function loadConversationWithAgent(conversationId) {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          userId: true,
          workspaceId: true,
          enabled: true,
          embedEnabled: true,
        },
      },
    },
  });
}

async function assertOwnerConversation(
  conversationId,
  userId,
  { write = false } = {}
) {
  const conversation = await loadConversationWithAgent(conversationId);
  if (!conversation) {
    throw httpError(404, "Conversation not found");
  }

  const workspace = await resolveActiveWorkspace(userId);
  if (
    conversation.agent.userId !== userId ||
    conversation.agent.workspaceId !== workspace.id
  ) {
    throw httpError(
      write ? 403 : 404,
      write ? "Not allowed to access this conversation" : "Conversation not found"
    );
  }

  return conversation;
}

function mapInboxRow(c) {
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
}

const SUMMARY_MESSAGE_LIMIT = 10;

export async function buildHandoffContextSummary(conversationId) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: SUMMARY_MESSAGE_LIMIT,
    select: { role: true, content: true, createdAt: true },
  });

  if (!rows.length) return null;

  return [...rows]
    .reverse()
    .map((m) => {
      const label =
        m.role === "USER" ? "Customer" : m.role === "HUMAN" ? "Human" : "AI";
      const text = String(m.content || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);
      return `${label}: ${text}`;
    })
    .join("\n");
}

export async function countWaitingForUser(userId) {
  const workspace = await resolveActiveWorkspace(userId);
  const waiting = await prisma.conversation.count({
    where: {
      status: CONVERSATION_STATUS.WAITING_HUMAN,
      agent: { userId, workspaceId: workspace.id },
    },
  });
  return { waiting };
}

export async function getDeskStatsForUser(userId, { days = 7 } = {}) {
  const workspace = await resolveActiveWorkspace(userId);
  const since = new Date();
  since.setDate(since.getDate() - Math.min(Math.max(days, 1), 90));

  const agentFilter = { userId, workspaceId: workspace.id };

  const [waiting, handoffsInRange, resolvedInRange] = await Promise.all([
    prisma.conversation.count({
      where: {
        status: CONVERSATION_STATUS.WAITING_HUMAN,
        agent: agentFilter,
      },
    }),
    prisma.conversation.count({
      where: {
        handoffAt: { gte: since },
        agent: agentFilter,
      },
    }),
    prisma.conversation.count({
      where: {
        status: CONVERSATION_STATUS.RESOLVED,
        handoffAt: { gte: since },
        agent: agentFilter,
      },
    }),
  ]);

  return {
    waiting,
    handoffsInRange,
    resolvedInRange,
    days,
    queueWarning: waiting >= DESK_WAITING_SOFT_CAP,
    softCap: DESK_WAITING_SOFT_CAP,
  };
}

export async function listInboxForUser(
  userId,
  { status = "WAITING_HUMAN", limit = 20, offset = 0 } = {}
) {
  const workspace = await resolveActiveWorkspace(userId);

  // Human desk only lists threads that requested a human (not every studio chat).
  const deskBase = {
    agent: { userId, workspaceId: workspace.id },
    handoffAt: { not: null },
  };

  let where;
  if (status === "ALL") {
    where = deskBase;
  } else if (status === "WAITING_HUMAN") {
    where = { ...deskBase, status: CONVERSATION_STATUS.WAITING_HUMAN };
  } else if (status === "OPEN") {
    // Includes "Return to AI" (status stays OPEN after desk session ends).
    where = { ...deskBase, status: CONVERSATION_STATUS.OPEN };
  } else if (status === "RESOLVED") {
    // Resolve & close → RESOLVED. Return to AI → OPEN + lastHandoffEndedAt.
    // Both should appear under Resolved so handled desk work is findable.
    where = {
      ...deskBase,
      OR: [
        { status: CONVERSATION_STATUS.RESOLVED },
        { lastHandoffEndedAt: { not: null } },
      ],
      NOT: { status: CONVERSATION_STATUS.WAITING_HUMAN },
    };
  } else {
    where = { ...deskBase, status };
  }

  const orderBy =
    status === "WAITING_HUMAN"
      ? [{ handoffAt: "desc" }, { startedAt: "desc" }]
      : [{ handoffAt: "desc" }, { startedAt: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: {
        id: true,
        agentId: true,
        category: true,
        sentiment: true,
        status: true,
        handoffReason: true,
        handoffSummary: true,
        handoffAt: true,
        handoffCount: true,
        lastHandoffEndedAt: true,
        assignedUserId: true,
        aiPaused: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
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
    conversations: rows.map(mapInboxRow),
    total,
    limit,
    offset,
    status,
  };
}

export async function triggerHandoff({
  conversationId,
  userId,
  publicAgentId,
  reason,
  summary,
}) {
  const conversation = await loadConversationWithAgent(conversationId);
  if (!conversation) {
    throw httpError(404, "Conversation not found");
  }

  if (publicAgentId) {
    if (
      conversation.agentId !== publicAgentId ||
      conversation.agent.embedEnabled === false ||
      conversation.agent.enabled === false
    ) {
      throw httpError(404, "Conversation not found");
    }
  } else if (userId) {
    const workspace = await resolveActiveWorkspace(userId);
    if (
      conversation.agent.userId !== userId ||
      conversation.agent.workspaceId !== workspace.id
    ) {
      throw httpError(404, "Conversation not found");
    }
  } else {
    throw httpError(403, "Not allowed");
  }

  if (isWaitingForHuman(conversation)) {
    return serializeHandoffResult(conversation);
  }

  const eligibility = evaluateHandoffEligibility(conversation);
  if (!eligibility.ok) {
    const status =
      eligibility.code === "cooldown" || eligibility.code === "limit_reached"
        ? 429
        : 409;
    throw httpError(status, eligibility.message, {
      code: eligibility.code,
      handoffCount: eligibility.handoffCount,
      handoffRemaining: eligibility.handoffRemaining,
      cooldownMs: eligibility.cooldownMs,
      cooldownUntil: eligibility.cooldownUntil,
    });
  }

  let contextSummary = summary?.trim() || null;
  if (!contextSummary) {
    try {
      contextSummary = await buildHandoffContextSummary(conversationId);
    } catch (err) {
      safeLogError("handoff summary build failed", {
        conversationId,
        code: err?.code || "HANDOFF_SUMMARY_FAIL",
      });
    }
  }

  const nextCount = Number(conversation.handoffCount || 0) + 1;

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: CONVERSATION_STATUS.WAITING_HUMAN,
      aiPaused: true,
      handoffAt: new Date(),
      handoffReason: reason?.trim() || null,
      handoffSummary: contextSummary,
      assignedUserId: conversation.agent.userId,
      humanTypingAt: null,
      handoffCount: nextCount,
      endedAt: null,
    },
    include: {
      agent: { select: { id: true, name: true, userId: true } },
    },
  });

  const ackMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: DESK_HANDOFF_ACK_MESSAGE,
      responseTime: null,
    },
  });

  return {
    ...serializeHandoffResult(updated),
    ackMessage: {
      id: ackMessage.id,
      role: ackMessage.role,
      content: ackMessage.content,
      createdAt: ackMessage.createdAt,
    },
  };
}

export async function resolveConversation({
  conversationId,
  userId,
  resumeAi = true,
}) {
  const conversation = await assertOwnerConversation(conversationId, userId);

  if (!canActAsHuman({ userId, agent: conversation.agent })) {
    throw httpError(403, "Not allowed to resolve this conversation");
  }

  if (!isWaitingForHuman(conversation)) {
    return {
      conversationId: conversation.id,
      ...serializeDeskState(conversation),
      agent: { id: conversation.agent.id, name: conversation.agent.name },
    };
  }

  const endedAt = new Date();
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: resumeAi
        ? CONVERSATION_STATUS.OPEN
        : CONVERSATION_STATUS.RESOLVED,
      aiPaused: false,
      endedAt: resumeAi ? null : endedAt,
      lastHandoffEndedAt: endedAt,
      humanTypingAt: null,
    },
    include: {
      agent: { select: { id: true, name: true } },
    },
  });

  return {
    conversationId: updated.id,
    ...serializeDeskState(updated),
    agent: updated.agent,
  };
}

export async function sendHumanReply({ conversationId, userId, message }) {
  const conversation = await assertOwnerConversation(conversationId, userId, {
    write: true,
  });

  if (!canActAsHuman({ userId, agent: conversation.agent })) {
    throw httpError(403, "Not allowed to reply as human");
  }

  if (!isWaitingForHuman(conversation)) {
    throw httpError(409, "Conversation is not waiting for a human reply");
  }

  const humanMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "HUMAN",
      content: message,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { humanTypingAt: null },
  });

  return {
    conversationId,
    message: {
      id: humanMessage.id,
      role: humanMessage.role,
      content: humanMessage.content,
      createdAt: humanMessage.createdAt,
    },
    ...serializeDeskState(conversation),
  };
}

function serializeHandoffResult(conversation) {
  return {
    conversationId: conversation.id,
    ...serializeDeskState(conversation),
    agent: conversation.agent
      ? { id: conversation.agent.id, name: conversation.agent.name }
      : undefined,
  };
}

export async function signalHumanTyping({ conversationId, userId }) {
  const conversation = await assertOwnerConversation(conversationId, userId, {
    write: true,
  });

  if (!canActAsHuman({ userId, agent: conversation.agent })) {
    throw httpError(403, "Not allowed to signal typing");
  }

  if (!isWaitingForHuman(conversation)) {
    return { ok: false, reason: "not_waiting" };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { humanTypingAt: new Date() },
  });

  return { ok: true };
}
