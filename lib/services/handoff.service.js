import prisma from "@/lib/prisma";
import {
  CONVERSATION_STATUS,
  DESK_HANDOFF_ACK_MESSAGE,
  HANDOFF_PRIORITY,
  canActAsHuman,
  evaluateHandoffEligibility,
  isWaitingForHuman,
  normalizeCannedReplies,
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

function mapInboxRow(c, viewerUserId) {
  const last = c.messages[0];
  return {
    id: c.id,
    agentId: c.agentId,
    category: c.category,
    sentiment: c.sentiment,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    createdAt: c.createdAt,
    ...serializeDeskState({ ...c, _viewerUserId: viewerUserId }),
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
    .filter((m) => m.role !== "INTERNAL")
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
  const agentFilter = { userId, workspaceId: workspace.id };
  const waitingWhere = {
    status: CONVERSATION_STATUS.WAITING_HUMAN,
    agent: agentFilter,
  };

  // Raw read so a stale Prisma client (missing deskInboxSeenAt) still works.
  const seenRows = await prisma.$queryRaw`
    SELECT "deskInboxSeenAt" FROM "Workspace" WHERE id = ${workspace.id}
  `;
  const seenAt = seenRows?.[0]?.deskInboxSeenAt ?? null;

  const unreadWhere = {
    ...waitingWhere,
    ...(seenAt ? { handoffAt: { gt: seenAt } } : {}),
  };

  const [waiting, unread] = await Promise.all([
    prisma.conversation.count({ where: waitingWhere }),
    prisma.conversation.count({ where: unreadWhere }),
  ]);

  return { waiting: unread, unread, totalWaiting: waiting };
}

export async function markDeskInboxSeen(userId) {
  const workspace = await resolveActiveWorkspace(userId);
  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET "deskInboxSeenAt" = NOW(), "updatedAt" = NOW()
    WHERE id = ${workspace.id}
  `;
  return countWaitingForUser(userId);
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
  { status = "WAITING_HUMAN", priority = "ALL", limit = 20, offset = 0 } = {}
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
    where = { ...deskBase, status: CONVERSATION_STATUS.OPEN };
  } else if (status === "RESOLVED") {
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

  if (priority && priority !== "ALL") {
    where = { ...where, handoffPriority: priority };
  }

  const orderBy =
    status === "WAITING_HUMAN"
      ? [{ handoffAt: "asc" }, { startedAt: "desc" }]
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
        handoffPriority: true,
        lastHandoffEndedAt: true,
        csatScore: true,
        csatAt: true,
        assignedUserId: true,
        claimedAt: true,
        aiPaused: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        agent: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
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
    conversations: rows.map((row) => mapInboxRow(row, userId)),
    total,
    limit,
    offset,
    status,
    priority,
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
      // Re-offer CSAT after the next resolve
      csatScore: null,
      csatAt: null,
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

  // Soft lock: claimed by another workspace member (future teams).
  if (
    conversation.claimedAt &&
    conversation.assignedUserId &&
    conversation.assignedUserId !== userId
  ) {
    throw httpError(
      409,
      "This thread is claimed by another teammate. Unclaim or ask them to release it.",
      { code: "CLAIMED_BY_OTHER" }
    );
  }

  const humanMessage = await prisma.message.create({
    data: {
      conversationId,
      role: "HUMAN",
      content: message,
    },
  });

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      humanTypingAt: null,
      // Auto-claim on first reply if unclaimed
      ...(conversation.claimedAt
        ? {}
        : { assignedUserId: userId, claimedAt: new Date() }),
    },
    include: {
      assignedUser: { select: { id: true, name: true } },
    },
  });

  return {
    conversationId,
    message: {
      id: humanMessage.id,
      role: humanMessage.role,
      content: humanMessage.content,
      createdAt: humanMessage.createdAt,
    },
    ...serializeDeskState({ ...updated, _viewerUserId: userId }),
  };
}

/**
 * Agent-only internal note — never returned on public embed APIs.
 */
export async function sendInternalNote({ conversationId, userId, message }) {
  const conversation = await assertOwnerConversation(conversationId, userId, {
    write: true,
  });

  if (!canActAsHuman({ userId, agent: conversation.agent })) {
    throw httpError(403, "Not allowed to add internal notes");
  }

  const text = String(message || "").trim();
  if (!text) {
    throw httpError(400, "Note is required");
  }

  const note = await prisma.message.create({
    data: {
      conversationId,
      role: "INTERNAL",
      content: text,
    },
  });

  return {
    conversationId,
    message: {
      id: note.id,
      role: note.role,
      content: note.content,
      createdAt: note.createdAt,
    },
    ...serializeDeskState({ ...conversation, _viewerUserId: userId }),
  };
}

export async function claimConversation({ conversationId, userId, claim }) {
  const conversation = await assertOwnerConversation(conversationId, userId, {
    write: true,
  });

  if (!isWaitingForHuman(conversation)) {
    throw httpError(409, "Only waiting threads can be claimed");
  }

  if (
    claim &&
    conversation.claimedAt &&
    conversation.assignedUserId &&
    conversation.assignedUserId !== userId
  ) {
    throw httpError(409, "Already claimed by another teammate", {
      code: "CLAIMED_BY_OTHER",
    });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: claim
      ? { assignedUserId: userId, claimedAt: new Date() }
      : { claimedAt: null },
    include: {
      agent: { select: { id: true, name: true, userId: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });

  return {
    conversationId: updated.id,
    ...serializeDeskState({ ...updated, _viewerUserId: userId }),
  };
}

export async function setHandoffPriority({ conversationId, userId, priority }) {
  const conversation = await assertOwnerConversation(conversationId, userId, {
    write: true,
  });

  if (!Object.values(HANDOFF_PRIORITY).includes(priority)) {
    throw httpError(400, "Invalid priority");
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { handoffPriority: priority },
    include: {
      agent: { select: { id: true, name: true, userId: true } },
      assignedUser: { select: { id: true, name: true } },
    },
  });

  return {
    conversationId: updated.id,
    ...serializeDeskState({ ...updated, _viewerUserId: userId }),
  };
}

export async function getDeskCannedReplies(userId) {
  const workspace = await resolveActiveWorkspace(userId);
  const row = await prisma.workspace.findUnique({
    where: { id: workspace.id },
    select: { deskCannedReplies: true },
  });
  return {
    replies: normalizeCannedReplies(row?.deskCannedReplies),
    workspaceId: workspace.id,
  };
}

export async function saveDeskCannedReplies(userId, replies) {
  const workspace = await resolveActiveWorkspace(userId);
  const normalized = normalizeCannedReplies(replies);
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { deskCannedReplies: normalized },
  });
  return { replies: normalized, workspaceId: workspace.id };
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

/**
 * Public visitor CSAT after Return to AI / Resolve & close.
 * @param {{ conversationId: string, agentId: string, score?: number|null, skip?: boolean }}
 */
export async function setConversationCsat({
  conversationId,
  agentId,
  score = null,
  skip = false,
}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.agentId !== agentId) {
    throw httpError(404, "Conversation not found");
  }

  if (!conversation.lastHandoffEndedAt) {
    throw httpError(409, "No desk session to rate", { code: "NO_DESK_SESSION" });
  }

  if (isWaitingForHuman(conversation)) {
    throw httpError(409, "Conversation is still with a human", {
      code: "STILL_WAITING",
    });
  }

  if (conversation.csatAt) {
    return {
      conversationId: conversation.id,
      ...serializeDeskState(conversation),
      alreadySubmitted: true,
    };
  }

  const now = new Date();
  const nextScore =
    skip || score == null
      ? null
      : Math.min(5, Math.max(1, Math.round(Number(score))));

  if (!skip && (nextScore == null || nextScore < 1 || nextScore > 5)) {
    throw httpError(400, "Score must be 1–5");
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      csatScore: nextScore,
      csatAt: now,
    },
  });

  return {
    conversationId: updated.id,
    ...serializeDeskState(updated),
    alreadySubmitted: false,
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
