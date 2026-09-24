import prisma from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/services/turn-run-state";

export { isTurnRunInFlightElsewhere } from "@/lib/services/turn-run-state";

export async function createTurnRun({ agentId, conversationId, workspaceId = null, clientMessageId = null, requestId = null, ownershipVersion = 0 }) {
  if (!agentId || !conversationId) return null;
  try {
    return await prisma.turnRun.create({
      data: { agentId, conversationId, workspaceId, clientMessageId, requestId, ownershipVersion },
    });
  } catch (error) {
    if (error?.code !== "P2002" || !clientMessageId) throw error;
    return prisma.turnRun.findUnique({
      where: { conversationId_clientMessageId: { conversationId, clientMessageId } },
    });
  }
}

export async function touchTurnRun(id, status = "RUNNING") {
  if (!id) return null;
  return prisma.turnRun.update({
    where: { id },
    data: { status, lastHeartbeatAt: new Date() },
  });
}

export async function finishTurnRun(id, { status = "COMPLETED", errorCode = null } = {}) {
  if (!id) return null;
  return prisma.turnRun.update({
    where: { id },
    data: { status, errorCode, finishedAt: new Date(), lastHeartbeatAt: new Date() },
  });
}

export async function listRecoverableTurnRuns({ conversationId = null, staleAfterMs = 30_000, limit = 50 } = {}) {
  return prisma.turnRun.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      lastHeartbeatAt: { lt: new Date(Date.now() - Math.max(5_000, staleAfterMs)) },
      ...(conversationId ? { conversationId } : {}),
    },
    orderBy: { lastHeartbeatAt: "asc" },
    take: Math.min(Math.max(Number(limit) || 50, 1), 100),
    select: {
      id: true, agentId: true, conversationId: true, clientMessageId: true,
      requestId: true, status: true, ownershipVersion: true,
      lastHeartbeatAt: true, startedAt: true,
    },
  });
}

export async function getActiveTurnRun(conversationId) {
  if (!conversationId) return null;
  return prisma.turnRun.findFirst({
    where: { conversationId, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, conversationId: true, clientMessageId: true,
      status: true, ownershipVersion: true, startedAt: true,
      lastHeartbeatAt: true,
    },
  });
}

export async function markTurnRunRecoverable(id) {
  return finishTurnRun(id, { status: "PAUSED", errorCode: "TURN_RECOVERY_REQUIRED" });
}
