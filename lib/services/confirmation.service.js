/**
 * F11-R2 / F14-A/B/E — ActionConfirmation lifecycle + durable evidence.
 */
import { randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { hashArgs } from "@/lib/actions/identity";
import { getAgentForUser } from "@/lib/services/agent.service";

const DEFAULT_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

function confirmationTtlMs() {
  const n = Number(process.env.ACTIONS_CONFIRMATION_TTL_MS);
  if (!Number.isFinite(n)) return DEFAULT_CONFIRMATION_TTL_MS;
  return Math.min(Math.max(Math.trunc(n), 60_000), 60 * 60_000);
}

/** Documented default (env may override at runtime via confirmationTtlMs). */
const CONFIRMATION_TTL_MS = DEFAULT_CONFIRMATION_TTL_MS;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function newEvidenceId() {
  return `ev_${randomBytes(12).toString("hex")}`;
}

function clip(value, max = 200) {
  const s = String(value || "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * F14-E — mark overdue PENDING rows as EXPIRED (idempotent).
 * @returns {Promise<number>} count updated
 */
export async function expireStalePendingConfirmations(conversationId = null) {
  const where = {
    status: "PENDING",
    expiresAt: { lt: new Date() },
    ...(conversationId ? { conversationId } : {}),
  };
  const result = await prisma.actionConfirmation.updateMany({
    where,
    data: { status: "EXPIRED" },
  });
  return result.count || 0;
}

export async function createPendingConfirmation(conversationId, actionId, args = {}) {
  if (!conversationId || !actionId) {
    throw httpError(400, "conversationId and actionId are required");
  }

  await expireStalePendingConfirmations(conversationId);

  const action = await prisma.agentAction.findUnique({
    where: { id: actionId },
    select: {
      id: true,
      agentId: true,
      enabled: true,
      name: true,
      description: true,
    },
  });
  if (!action || !action.enabled) {
    throw httpError(404, "Action not found");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, agentId: true, customerSubject: true },
  });
  if (!conversation) {
    throw httpError(404, "Conversation not found");
  }
  if (conversation.agentId !== action.agentId) {
    throw httpError(400, "Action does not belong to this conversation's agent");
  }

  const argsHash = hashArgs(args);
  const expiresAt = new Date(Date.now() + confirmationTtlMs());
  const userSubject = clip(conversation.customerSubject, 320);

  const existing = await prisma.actionConfirmation.findFirst({
    where: {
      conversationId,
      actionId,
      argsHash,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return serialize(existing, action);
  }

  const row = await prisma.actionConfirmation.create({
    data: {
      conversationId,
      actionId,
      argsHash,
      status: "PENDING",
      expiresAt,
      ...(userSubject ? { userSubject } : {}),
    },
  });

  return serialize(row, action);
}

/**
 * @param {"approve"|"deny"} decision
 * @param {{ userSubject?: string|null, userDisplay?: string|null, clientIp?: string|null }} [evidence]
 */
export async function resolveConfirmation(
  id,
  conversationId,
  decision,
  evidence = {}
) {
  if (!id || !conversationId) {
    throw httpError(400, "confirmation id and conversationId are required");
  }
  const nextStatus = decision === "deny" ? "DENIED" : "APPROVED";

  const existing = await prisma.actionConfirmation.findFirst({
    where: { id, conversationId },
    include: {
      action: { select: { name: true, description: true } },
      conversation: { select: { customerSubject: true } },
    },
  });
  if (!existing) {
    throw httpError(404, "Confirmation not found");
  }

  if (
    existing.status === "EXPIRED" ||
    existing.expiresAt.getTime() < Date.now()
  ) {
    if (existing.status !== "EXPIRED") {
      await prisma.actionConfirmation.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
    }
    throw httpError(400, "Confirmation expired — ask again.", {
      code: "CONFIRMATION_EXPIRED",
    });
  }

  if (existing.status === nextStatus && existing.evidenceId) {
    return serialize(existing, existing.action);
  }
  if (existing.status !== "PENDING") {
    throw httpError(400, `Confirmation is ${existing.status}`);
  }

  const userSubject =
    clip(evidence.userSubject, 320) ||
    existing.userSubject ||
    clip(existing.conversation?.customerSubject, 320);
  const userDisplay = clip(evidence.userDisplay, 200);
  const decidedIp = clip(evidence.clientIp, 64);
  const evidenceId = existing.evidenceId || newEvidenceId();

  const row = await prisma.actionConfirmation.update({
    where: { id },
    data: {
      status: nextStatus,
      evidenceId,
      decidedAt: new Date(),
      ...(userSubject ? { userSubject } : {}),
      ...(userDisplay ? { userDisplay } : {}),
      ...(decidedIp ? { decidedIp } : {}),
    },
  });
  return serialize(row, existing.action);
}

export async function approveConfirmation(id, conversationId, evidence = {}) {
  return resolveConfirmation(id, conversationId, "approve", evidence);
}

export async function denyConfirmation(id, conversationId, evidence = {}) {
  return resolveConfirmation(id, conversationId, "deny", evidence);
}

/**
 * Find a still-valid APPROVED confirmation for this args hash.
 */
export async function getApprovedConfirmation(conversationId, actionId, argsHash) {
  if (!conversationId || !actionId || !argsHash) return null;

  await expireStalePendingConfirmations(conversationId);

  const row = await prisma.actionConfirmation.findFirst({
    where: {
      conversationId,
      actionId,
      argsHash,
      status: "APPROVED",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: {
      action: { select: { name: true, description: true } },
    },
  });

  return row ? serialize(row, row.action) : null;
}

/**
 * Owner audit: recent confirmations for an agent (F14-B).
 */
export async function listConfirmationsForAgent(agentId, userId, { take = 30 } = {}) {
  await getAgentForUser(agentId, userId);
  const limit = Math.min(Math.max(Number(take) || 30, 1), 100);

  const rows = await prisma.actionConfirmation.findMany({
    where: { action: { agentId } },
    orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      action: { select: { id: true, name: true } },
      conversation: {
        select: { id: true, customerSubject: true },
      },
    },
  });

  return rows.map((row) =>
    serialize(row, row.action, {
      conversationId: row.conversationId,
      conversationSubject: row.conversation?.customerSubject || null,
    })
  );
}

function serialize(row, action = null, extra = {}) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    actionId: row.actionId,
    actionName: action?.name || row.action?.name || null,
    actionDescription:
      action?.description || row.action?.description || null,
    argsHash: row.argsHash,
    status: row.status,
    evidenceId: row.evidenceId || null,
    userSubject: row.userSubject || null,
    userDisplay: row.userDisplay || null,
    decidedAt: row.decidedAt || null,
    decidedIp: row.decidedIp || null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extra,
  };
}

export { CONFIRMATION_TTL_MS, confirmationTtlMs };
