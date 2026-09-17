/**
 * Agent Trace — reconstruct one turn from TurnRun + ToolRun (+ message meta).
 * Never returns raw provider bodies, tool result payloads, or secrets.
 */

import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";
import { canManageAgentActions } from "@/lib/actions/action-config";
import {
  assembleAgentTurnTrace,
  assertTracePayloadSafe,
} from "@/lib/services/agent-trace-format";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

async function requireManagedAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);
  if (!canManageAgentActions({ userId, agent })) {
    throw httpError(403, "Not allowed to view traces for this agent");
  }
  return agent;
}

async function loadToolRunsForTurn(turn) {
  const windowEnd = turn.finishedAt || turn.lastHeartbeatAt || new Date();
  const windowStart = turn.startedAt;
  const or = [];
  if (turn.requestId) {
    or.push({ requestId: turn.requestId });
  }
  or.push({
    createdAt: {
      gte: windowStart,
      lte: new Date(new Date(windowEnd).getTime() + 2_000),
    },
  });

  return prisma.toolRun.findMany({
    where: {
      agentId: turn.agentId,
      conversationId: turn.conversationId,
      OR: or,
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      actionId: true,
      mcpToolId: true,
      status: true,
      durationMs: true,
      httpStatus: true,
      errorCode: true,
      errorCategory: true,
      requestId: true,
      createdAt: true,
      action: { select: { name: true } },
    },
  });
}

async function loadMessagesForTurn(turn) {
  const windowEnd = turn.finishedAt || turn.lastHeartbeatAt || new Date();
  const where = {
    conversationId: turn.conversationId,
    role: { in: ["USER", "ASSISTANT"] },
    OR: [
      {
        createdAt: {
          gte: new Date(new Date(turn.startedAt).getTime() - 5_000),
          lte: new Date(new Date(windowEnd).getTime() + 5_000),
        },
      },
    ],
  };
  if (turn.clientMessageId) {
    where.OR.push({ clientMessageId: turn.clientMessageId });
  }

  return prisma.message.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true,
      role: true,
      content: true,
      clientMessageId: true,
      responseTime: true,
      createdAt: true,
    },
  });
}

/**
 * Owner-scoped turn trace.
 */
export async function getAgentTurnTraceForOwner(agentId, turnRunId, userId) {
  await requireManagedAgent(agentId, userId);
  const turn = await prisma.turnRun.findFirst({
    where: { id: turnRunId, agentId },
  });
  if (!turn) throw httpError(404, "Turn not found");

  const [toolRuns, messages] = await Promise.all([
    loadToolRunsForTurn(turn),
    loadMessagesForTurn(turn),
  ]);
  return assembleAgentTurnTrace({ turn, toolRuns, messages });
}

/**
 * Admin-scoped turn trace (any agent).
 */
export async function getAgentTurnTraceForAdmin(turnRunId) {
  const turn = await prisma.turnRun.findFirst({
    where: { id: turnRunId },
  });
  if (!turn) throw httpError(404, "Turn not found");

  const [toolRuns, messages] = await Promise.all([
    loadToolRunsForTurn(turn),
    loadMessagesForTurn(turn),
  ]);
  return assembleAgentTurnTrace({ turn, toolRuns, messages });
}

/**
 * Recent turns for an agent (optional conversation filter).
 */
export async function listAgentTurnTracesForOwner(
  agentId,
  userId,
  { conversationId = null, take = 20 } = {}
) {
  await requireManagedAgent(agentId, userId);
  const limit = Math.min(Math.max(Number(take) || 20, 1), 50);
  const rows = await prisma.turnRun.findMany({
    where: {
      agentId,
      ...(conversationId ? { conversationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      conversationId: true,
      clientMessageId: true,
      requestId: true,
      status: true,
      errorCode: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
    },
  });
  return assertTracePayloadSafe({ turns: rows });
}

export {
  assembleAgentTurnTrace,
  assertTracePayloadSafe,
  buildActivityPhasesFromTrace,
  previewMessageContent,
  TRACE_FORBIDDEN_KEYS,
} from "@/lib/services/agent-trace-format";
