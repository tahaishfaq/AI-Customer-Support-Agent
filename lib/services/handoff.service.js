import prisma from "@/lib/prisma";
import {
  CONVERSATION_STATUS,
  HANDOFF_PRIORITY,
  evaluateHandoffEligibility,
  isWaitingForHuman,
  normalizeCannedReplies,
  serializeDeskState,
} from "@/lib/desk/conversation-desk";
import { DESK_WAITING_SOFT_CAP } from "@/lib/desk/desk-config";
import { deskAccessDenial, deskPermissions, deskSettingsSchema, isAssignableRole, pickLeastBusy, resolveDeskSettings, slaState } from "@/lib/desk/routing";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { isWorkspaceOwnerRecord, resolveWorkspaceAccess } from "@/lib/workspace-authz";
import { resolveAgentWorkspaceAccess } from "@/lib/services/agent.service";
import { handoffAckMessage } from "@/lib/desk/support-hours";
import { mergeCustomization } from "@/lib/customization/defaults";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { safeLogError } from "@/lib/observability/safe-log";
import { enqueueRealtimeEvent } from "@/lib/realtime/outbox";
import { REALTIME_EVENT_TYPES, REALTIME_VISIBILITIES } from "@/lib/realtime/constants";

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
          customization: true,
        },
      },
    },
  });
}

/**
 * Desk guard (Level 2 · M3). The agent owner keeps full access (today's behaviour). Workspace
 * teammates get access by role — Viewer read, Member reply, Owner/Admin manage — and only to
 * chats that were handed to the desk (handoffAt set), never to every studio/embed chat.
 * @param {"read"|"reply"|"manage"} need
 * @returns {Promise<object>} the conversation, with `_desk` = { canRead, canReply, canManage, isOwner }
 */
export async function assertDeskConversation(conversationId, userId, need = "read") {
  const conversation = await loadConversationWithAgent(conversationId);
  const write = need !== "read";
  const denied = () =>
    httpError(
      write ? 403 : 404,
      write ? "Not allowed to access this conversation" : "Conversation not found"
    );
  if (!conversation) {
    throw httpError(404, "Conversation not found");
  }

  const workspace = await resolveActiveWorkspace(userId);
  if (conversation.agent.workspaceId !== workspace.id) {
    throw denied();
  }

  const isOwner = conversation.agent.userId === userId;
  let perms = { canRead: true, canReply: true, canManage: true };
  if (!isOwner) {
    const { access } = await resolveAgentWorkspaceAccess(conversation.agent, userId);
    perms = deskPermissions(access);
  }
  const denial = deskAccessDenial({ isOwner, perms, handoffAt: conversation.handoffAt, need });
  if (denial) throw httpError(denial.status, denial.message);

  return { ...conversation, _desk: { ...perms, isOwner } };
}

/**
 * Who gets a new handoff. owner → the agent owner (today's behaviour); manual → unassigned;
 * least_busy → the pool teammate (Owner/Admin/Member, still in the workspace) with the fewest
 * waiting chats, ties to whoever was assigned least recently. No eligible teammate → owner.
 */
async function chooseAssignee(tx, agent, settings) {
  if (settings.assignment === "manual") return null;
  if (settings.assignment !== "least_busy") return agent.userId;
  const workspace = await tx.workspace.findUnique({
    where: { id: agent.workspaceId },
    select: { userId: true, members: { select: { userId: true, role: true } } },
  });
  if (!workspace) return agent.userId;
  const eligible = new Set([
    workspace.userId,
    ...workspace.members.filter((m) => isAssignableRole(m.role)).map((m) => m.userId),
  ]);
  const pool = (settings.pool.length ? settings.pool : [workspace.userId, ...workspace.members.map((m) => m.userId)])
    .filter((id, index, list) => eligible.has(id) && list.indexOf(id) === index);
  if (!pool.length) return agent.userId;
  const load = await tx.conversation.groupBy({
    by: ["assignedUserId"],
    where: {
      assignedUserId: { in: pool },
      status: CONVERSATION_STATUS.WAITING_HUMAN,
      agent: { workspaceId: agent.workspaceId },
    },
    _count: { _all: true },
    _max: { handoffAt: true },
  });
  const byUser = new Map(load.map((row) => [row.assignedUserId, row]));
  return (
    pickLeastBusy(
      pool.map((userId) => ({
        userId,
        openCount: byUser.get(userId)?._count?._all || 0,
        lastAssignedAt: byUser.get(userId)?._max?.handoffAt || null,
      }))
    ) || agent.userId
  );
}

/** Workspace desk routing/SLA settings (invalid or missing → owner assignment, no SLA). */
async function loadDeskSettings(workspaceId) {
  const row = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { deskSettings: true } });
  return resolveDeskSettings(row?.deskSettings);
}

/** The caller's desk permissions in a workspace (owner record or membership role). */
async function workspaceDeskAccess(workspace, userId) {
  const membership = isWorkspaceOwnerRecord(workspace, userId)
    ? null
    : await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
        select: { workspaceId: true, userId: true, role: true },
      });
  return deskPermissions(resolveWorkspaceAccess({ workspace, userId, membership }));
}

function mapInboxRow(c, viewerUserId, settings = null) {
  const last = c.messages[0];
  return {
    sla: slaState({
      handoffAt: c.handoffAt,
      firstHumanReplyAt: c.firstHumanReplyAt,
      status: c.status,
      minutes: settings?.slaFirstReplyMinutes,
    }),
    id: c.id,
    agentId: c.agentId,
    source: c.source,
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
  // Team desk: every agent in the active workspace (teammates included), not only the caller's.
  const agentFilter = { workspaceId: workspace.id };
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
  await prisma.$transaction(async (tx) => {
    const updated = await tx.workspace.update({
      where: { id: workspace.id },
      data: {
        deskInboxSeenAt: new Date(),
        inboxVersion: { increment: 1 },
      },
      select: { id: true, inboxVersion: true },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.INBOX_SEEN_UPDATED,
      visibility: REALTIME_VISIBILITIES.OWNER,
      userId,
      workspaceId: updated.id,
      aggregateType: "workspace-inbox",
      aggregateVersion: updated.inboxVersion,
      payload: { workspaceId: updated.id, seenAt: new Date().toISOString() },
    });
  });
  return countWaitingForUser(userId);
}

export async function getDeskStatsForUser(userId, { days = 7 } = {}) {
  const workspace = await resolveActiveWorkspace(userId);
  const since = new Date();
  since.setDate(since.getDate() - Math.min(Math.max(days, 1), 90));

  // Team desk: every agent in the active workspace (teammates included), not only the caller's.
  const agentFilter = { workspaceId: workspace.id };

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

  const [settings, desk] = await Promise.all([
    loadDeskSettings(workspace.id),
    workspaceDeskAccess(workspace, userId),
  ]);

  // Human desk only lists threads that requested a human (not every studio chat), for the
  // whole workspace team.
  const deskBase = {
    agent: { workspaceId: workspace.id },
    handoffAt: { not: null },
  };

  let where;
  if (status === "ALL") {
    where = deskBase;
  } else if (status === "WAITING_HUMAN") {
    where = { ...deskBase, status: CONVERSATION_STATUS.WAITING_HUMAN };
  } else if (status === "MINE") {
    where = { ...deskBase, status: CONVERSATION_STATUS.WAITING_HUMAN, assignedUserId: userId };
  } else if (status === "OVERDUE") {
    where = settings.slaFirstReplyMinutes
      ? {
          ...deskBase,
          status: CONVERSATION_STATUS.WAITING_HUMAN,
          firstHumanReplyAt: null,
          handoffAt: { lt: new Date(Date.now() - settings.slaFirstReplyMinutes * 60_000) },
        }
      : { ...deskBase, id: { in: [] } }; // no SLA configured → nothing can be overdue
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
    status === "WAITING_HUMAN" || status === "MINE" || status === "OVERDUE"
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
        source: true,
        category: true,
        sentiment: true,
        status: true,
        handoffReason: true,
        handoffSummary: true,
        handoffAt: true,
        handoffCount: true,
        handoffPriority: true,
        lastHandoffEndedAt: true,
        firstHumanReplyAt: true,
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
    conversations: rows.map((row) => mapInboxRow(row, userId, settings)),
    total,
    limit,
    offset,
    status,
    priority,
    desk,
    deskSettings: settings,
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
  const deskSettings = await loadDeskSettings(conversation.agent.workspaceId);

  const { updated, ackMessage } = await prisma.$transaction(async (tx) => {
    const assigneeId = await chooseAssignee(tx, conversation.agent, deskSettings);
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: {
        status: CONVERSATION_STATUS.WAITING_HUMAN,
        aiPaused: true,
        handoffAt: new Date(),
        handoffReason: reason?.trim() || null,
        handoffSummary: contextSummary,
        // Workspace routing (owner by default); a new handoff also restarts the first-reply SLA.
        assignedUserId: assigneeId,
        firstHumanReplyAt: null,
        humanTypingAt: null,
        handoffCount: nextCount,
        endedAt: null,
        realtimeVersion: { increment: 1 },
        // Re-offer CSAT after the next resolve
        csatScore: null,
        csatAt: null,
      },
      include: {
        agent: { select: { id: true, name: true, userId: true, workspaceId: true } },
      },
    });

    const ackMessage = await tx.message.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        // Outside the agent's support hours the customer is told the team is offline.
        content: handoffAckMessage(mergeCustomization(conversation.agent.customization).support),
        responseTime: null,
        answerState: "HANDOFF",
      },
    });

    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.HANDOFF_CREATED,
      visibility: REALTIME_VISIBILITIES.BOTH,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: {
        status: updated.status,
        aiPaused: updated.aiPaused,
        handoffReason: updated.handoffReason,
        handoffAt: updated.handoffAt,
        handoffCount: updated.handoffCount,
      },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.MESSAGE_CREATED,
      visibility: REALTIME_VISIBILITIES.BOTH,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: {
        messageId: ackMessage.id,
        role: ackMessage.role,
        content: ackMessage.content,
        createdAt: ackMessage.createdAt,
      },
    });
    return { updated, ackMessage };
  });

  // Level 3 · L5 — reverse a prior resolution charge when the chat is handed to a human.
  import("@/lib/services/billing/resolution-charge.service")
    .then(({ reverseResolutionCharge }) =>
      reverseResolutionCharge(conversationId, "handoff")
    )
    .catch(() => {});

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
  const conversation = await assertDeskConversation(conversationId, userId, "reply");

  if (!isWaitingForHuman(conversation)) {
    return {
      conversationId: conversation.id,
      ...serializeDeskState(conversation),
      agent: { id: conversation.agent.id, name: conversation.agent.name },
    };
  }

  const endedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: {
        status: resumeAi
          ? CONVERSATION_STATUS.OPEN
          : CONVERSATION_STATUS.RESOLVED,
        aiPaused: false,
        endedAt: resumeAi ? null : endedAt,
        lastHandoffEndedAt: endedAt,
        resolvedBy: "HUMAN",
        humanTypingAt: null,
        realtimeVersion: { increment: 1 },
      },
      include: {
        agent: { select: { id: true, name: true, userId: true, workspaceId: true } },
      },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.STATUS_UPDATED,
      visibility: REALTIME_VISIBILITIES.BOTH,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: {
        status: updated.status,
        aiPaused: updated.aiPaused,
        endedAt: updated.endedAt,
        lastHandoffEndedAt: updated.lastHandoffEndedAt,
      },
    });
    return updated;
  });

  return {
    conversationId: updated.id,
    ...serializeDeskState(updated),
    agent: updated.agent,
  };
}

export async function sendHumanReply({ conversationId, userId, message }) {
  const conversation = await assertDeskConversation(conversationId, userId, "reply");

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

  const { humanMessage, updated } = await prisma.$transaction(async (tx) => {
    let storeContent = message;
    try {
      const { redactPiiText } = await import("@/lib/privacy/redaction");
      const workspace = conversation.agent?.workspaceId
        ? await tx.workspace.findUnique({
            where: { id: conversation.agent.workspaceId },
            select: { privacy: true },
          })
        : null;
      storeContent = redactPiiText(message, workspace?.privacy);
    } catch {
      storeContent = message;
    }

    const humanMessage = await tx.message.create({
      data: {
        conversationId,
        role: "HUMAN",
        content: storeContent,
      },
    });

    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: {
        humanTypingAt: null,
        realtimeVersion: { increment: 1 },
        // SLA: the first human reply after this handoff.
        ...(conversation.firstHumanReplyAt ? {} : { firstHumanReplyAt: new Date() }),
        // Auto-claim on first reply if unclaimed
        ...(conversation.claimedAt
          ? {}
          : { assignedUserId: userId, claimedAt: new Date() }),
      },
      include: {
        agent: { select: { id: true, userId: true, workspaceId: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.MESSAGE_CREATED,
      visibility: REALTIME_VISIBILITIES.BOTH,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: {
        messageId: humanMessage.id,
        role: humanMessage.role,
        content: humanMessage.content,
        createdAt: humanMessage.createdAt,
      },
    });
    if (!conversation.claimedAt) {
      await enqueueRealtimeEvent(tx, {
        eventType: REALTIME_EVENT_TYPES.CLAIM_UPDATED,
        visibility: REALTIME_VISIBILITIES.OWNER,
        userId: updated.agent.userId,
        workspaceId: updated.agent.workspaceId,
        agentId: updated.agent.id,
        conversationId,
        aggregateType: "conversation",
        aggregateVersion: updated.realtimeVersion,
        payload: { assignedUserId: updated.assignedUserId, claimedAt: updated.claimedAt },
      });
    }
    return { humanMessage, updated };
  });

  await maybeEmailHumanReply(conversation, humanMessage);

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

async function maybeEmailHumanReply(conversation, humanMessage) {
  if (conversation.source !== "EMAIL") return;
  const agent = await prisma.agent.findUnique({
    where: { id: conversation.agentId },
    select: {
      emailChannelAddress: true,
      emailChannel: true,
      name: true,
    },
  });
  if (!agent?.emailChannelAddress) return;
  const fromAddr = extractEmailAddressFromSubject(conversation.customerSubject);
  if (!fromAddr) return;
  const channel =
    agent.emailChannel && typeof agent.emailChannel === "object"
      ? agent.emailChannel
      : {};
  const fromName = String(channel.fromName || agent.name || "Support").slice(0, 80);
  const { sendSupportEmailReply } = await import("@/lib/email/support-reply");
  await sendSupportEmailReply({
    from: `${fromName.replace(/[<>\r\n]/g, "")} <${agent.emailChannelAddress}>`,
    to: fromAddr,
    subject: `Re: support [aide:${conversation.id.slice(0, 24)}]`,
    text: String(humanMessage.content || ""),
    conversationId: conversation.id,
  }).catch(() => null);
}

function extractEmailAddressFromSubject(customerSubject) {
  const raw = String(customerSubject || "");
  if (!raw.startsWith("email:")) return null;
  const addr = raw.slice("email:".length).trim().toLowerCase();
  return addr.includes("@") ? addr : null;
}

/**
 * Agent-only internal note — never returned on public embed APIs.
 */
export async function sendInternalNote({ conversationId, userId, message }) {
  const conversation = await assertDeskConversation(conversationId, userId, "reply");

  const text = String(message || "").trim();
  if (!text) {
    throw httpError(400, "Note is required");
  }

  const { note, updated } = await prisma.$transaction(async (tx) => {
    const note = await tx.message.create({
      data: {
        conversationId,
        role: "INTERNAL",
        content: text,
      },
    });
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: { realtimeVersion: { increment: 1 } },
      include: { agent: { select: { id: true, userId: true, workspaceId: true } } },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.MESSAGE_CREATED,
      visibility: REALTIME_VISIBILITIES.OWNER,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: {
        messageId: note.id,
        role: note.role,
        content: note.content,
        createdAt: note.createdAt,
      },
    });
    return { note, updated };
  });

  return {
    conversationId,
    message: {
      id: note.id,
      role: note.role,
      content: note.content,
      createdAt: note.createdAt,
    },
    ...serializeDeskState({ ...updated, _viewerUserId: userId }),
  };
}

export async function claimConversation({ conversationId, userId, claim }) {
  const conversation = await assertDeskConversation(conversationId, userId, "reply");

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

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: {
        ...(claim
          ? { assignedUserId: userId, claimedAt: new Date() }
          : { claimedAt: null }),
        realtimeVersion: { increment: 1 },
      },
      include: {
        agent: { select: { id: true, name: true, userId: true, workspaceId: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.CLAIM_UPDATED,
      visibility: REALTIME_VISIBILITIES.OWNER,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: { assignedUserId: updated.assignedUserId, claimedAt: updated.claimedAt },
    });
    return updated;
  });

  return {
    conversationId: updated.id,
    ...serializeDeskState({ ...updated, _viewerUserId: userId }),
  };
}

/**
 * Level 2 · M3 — assign a waiting chat to a teammate (or unassign with null).
 * Owner/Admin may assign anyone; a Member may take an unassigned chat or hand on their own.
 * The target must still be an Owner/Admin/Member of the chat's workspace.
 */
export async function assignConversation({ conversationId, userId, assigneeId = null }) {
  const conversation = await assertDeskConversation(conversationId, userId, "reply");
  const perms = conversation._desk;
  const current = conversation.assignedUserId || null;
  if (!perms.canManage) {
    const takingUnassigned = !current && assigneeId === userId;
    const handingOnOwn = current === userId;
    if (!takingUnassigned && !handingOnOwn) {
      throw httpError(403, "Only the assignee or a workspace admin can reassign this chat");
    }
  }
  if (assigneeId) {
    const eligible = await listAssignableUserIds(conversation.agent.workspaceId);
    if (!eligible.has(assigneeId)) {
      throw httpError(400, "That person cannot be assigned chats in this workspace", { code: "ASSIGNEE_NOT_ELIGIBLE" });
    }
  }
  if (assigneeId === current) {
    return { conversationId, ...serializeDeskState({ ...conversation, _viewerUserId: userId }) };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      // A new assignee starts unclaimed: they (or anyone allowed) claim by replying.
      data: { assignedUserId: assigneeId, claimedAt: null, realtimeVersion: { increment: 1 } },
      include: {
        agent: { select: { id: true, name: true, userId: true, workspaceId: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.CLAIM_UPDATED,
      visibility: REALTIME_VISIBILITIES.OWNER,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: { assignedUserId: updated.assignedUserId, claimedAt: updated.claimedAt },
    });
    return updated;
  });
  await writeAuditEvent({
    adminId: userId,
    action: "desk.assign",
    targetType: "conversation",
    targetId: conversationId,
    metadata: { from: current, to: assigneeId },
  });
  return { conversationId: updated.id, ...serializeDeskState({ ...updated, _viewerUserId: userId }) };
}

/** Workspace owner + Owner/Admin/Member seats (Viewers cannot be assigned chats). */
async function listAssignableUserIds(workspaceId) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { userId: true, members: { select: { userId: true, role: true } } },
  });
  if (!workspace) return new Set();
  return new Set([workspace.userId, ...workspace.members.filter((m) => isAssignableRole(m.role)).map((m) => m.userId)]);
}

/** Desk settings + assignable teammates + the caller's desk permissions (active workspace). */
export async function getDeskSettingsForUser(userId) {
  const workspace = await resolveActiveWorkspace(userId);
  const [settings, desk, team] = await Promise.all([
    loadDeskSettings(workspace.id),
    workspaceDeskAccess(workspace, userId),
    prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: {
        user: { select: { id: true, name: true, email: true } },
        members: { select: { role: true, user: { select: { id: true, name: true, email: true } } } },
      },
    }),
  ]);
  if (!desk.canRead) throw httpError(404, "Workspace not found");
  const teammates = [];
  if (team?.user) teammates.push({ userId: team.user.id, name: team.user.name || team.user.email, role: "OWNER" });
  for (const member of team?.members || []) {
    if (!isAssignableRole(member.role) || member.user.id === team?.user?.id) continue;
    teammates.push({ userId: member.user.id, name: member.user.name || member.user.email, role: member.role });
  }
  return { settings, desk, teammates, viewerUserId: userId };
}

/** Save routing + SLA (Owner/Admin). Pool ids that are not assignable teammates are dropped. */
export async function saveDeskSettingsForUser(userId, input) {
  const workspace = await resolveActiveWorkspace(userId);
  const desk = await workspaceDeskAccess(workspace, userId);
  if (!desk.canManage) throw httpError(403, "Only workspace owners and admins can change desk routing");
  const parsed = deskSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw httpError(400, "Validation failed", { issues: parsed.error.issues.map((issue) => issue.message) });
  }
  const eligible = await listAssignableUserIds(workspace.id);
  const settings = { ...parsed.data, pool: parsed.data.pool.filter((id) => eligible.has(id)) };
  await prisma.workspace.update({ where: { id: workspace.id }, data: { deskSettings: settings } });
  await writeAuditEvent({ adminId: userId, action: "desk.settings", targetType: "workspace", targetId: workspace.id, metadata: settings });
  return getDeskSettingsForUser(userId);
}

export async function setHandoffPriority({ conversationId, userId, priority }) {
  const conversation = await assertDeskConversation(conversationId, userId, "reply");

  if (!Object.values(HANDOFF_PRIORITY).includes(priority)) {
    throw httpError(400, "Invalid priority");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: { handoffPriority: priority, realtimeVersion: { increment: 1 } },
      include: {
        agent: { select: { id: true, name: true, userId: true, workspaceId: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.PRIORITY_UPDATED,
      visibility: REALTIME_VISIBILITIES.OWNER,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: { handoffPriority: updated.handoffPriority },
    });
    return updated;
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

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: {
        csatScore: nextScore,
        csatAt: now,
        realtimeVersion: { increment: 1 },
      },
      include: { agent: { select: { id: true, userId: true, workspaceId: true } } },
    });
    await enqueueRealtimeEvent(tx, {
      eventType: REALTIME_EVENT_TYPES.CSAT_UPDATED,
      visibility: REALTIME_VISIBILITIES.OWNER,
      userId: updated.agent.userId,
      workspaceId: updated.agent.workspaceId,
      agentId: updated.agent.id,
      conversationId,
      aggregateType: "conversation",
      aggregateVersion: updated.realtimeVersion,
      payload: { csatScore: updated.csatScore, csatAt: updated.csatAt },
    });
    return updated;
  });

  return {
    conversationId: updated.id,
    ...serializeDeskState(updated),
    alreadySubmitted: false,
  };
}

export async function signalHumanTyping({ conversationId, userId }) {
  const conversation = await assertDeskConversation(conversationId, userId, "reply");

  if (!isWaitingForHuman(conversation)) {
    return { ok: false, reason: "not_waiting" };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { humanTypingAt: new Date() },
  });

  return { ok: true };
}
