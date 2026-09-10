import prisma from "@/lib/prisma";
import {
  assertWriteTransition,
  buildScopedWriteKey,
  buildWriteRequestFingerprint,
  shouldDispatch,
} from "@/lib/actions/durable-write";

function serviceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function prepareWriteIdentity(input = {}) {
  const requestFingerprint = buildWriteRequestFingerprint(input);
  const idempotencyKey = buildScopedWriteKey({ ...input, requestFingerprint });
  return { requestFingerprint, idempotencyKey };
}

export async function createPreparedWrite(input = {}) {
  const identity = prepareWriteIdentity(input);
  return prisma.durableWriteOperation.create({
    data: {
      agentId: String(input.agentId),
      workspaceId: String(input.workspaceId),
      conversationId: input.conversationId || null,
      customerSubject: input.customerSubject || null,
      principalScope: String(input.principalScope || "unknown"),
      actionId: input.actionId || null,
      actionRevisionId: input.actionRevisionId || null,
      approvalId: input.approvalId || null,
      logicalOperationId: String(input.logicalOperationId),
      idempotencyKey: identity.idempotencyKey,
      requestFingerprint: identity.requestFingerprint,
      upstreamIdempotencyKey: input.upstreamIdempotencyKey || identity.idempotencyKey,
    },
  });
}

export async function claimPreparedWrite({ id, owner, leaseMs = 30_000 } = {}) {
  if (!id || !owner) throw serviceError("WRITE_CLAIM_INVALID", "Write id and owner are required");
  const current = await prisma.durableWriteOperation.findUnique({ where: { id } });
  if (!current || !shouldDispatch({ status: current.status, leaseUntil: current.leaseUntil })) {
    throw serviceError("WRITE_NOT_DISPATCHABLE", "Write is not dispatchable");
  }
  assertWriteTransition(current.status, "IN_FLIGHT");
  const leaseUntil = new Date(Date.now() + Math.max(5_000, Math.min(leaseMs, 120_000)));
  const claimed = await prisma.durableWriteOperation.updateMany({
    where: {
      id,
      OR: [
        { status: "PREPARED" },
        { status: "IN_FLIGHT", leaseUntil: { lt: new Date() } },
        { status: "IN_FLIGHT", leaseUntil: null },
      ],
    },
    data: {
      status: "IN_FLIGHT",
      leaseOwner: owner,
      leaseUntil,
      attempt: { increment: 1 },
      dispatchedAt: new Date(),
      reconciliationStatus: "NOT_REQUIRED",
    },
  });
  if (claimed.count !== 1) throw serviceError("WRITE_CLAIM_LOST", "Write lease was claimed by another worker");
  return prisma.durableWriteOperation.findUnique({ where: { id } });
}

export async function finishWrite({ id, owner, status, httpStatus = null, outcomeCode = null, errorCode = null } = {}) {
  const current = await prisma.durableWriteOperation.findUnique({ where: { id } });
  if (!current || current.leaseOwner !== owner) throw serviceError("WRITE_LEASE_INVALID", "Write lease is not owned by this worker");
  assertWriteTransition(current.status, status);
  const unknown = status === "OUTCOME_UNKNOWN";
  return prisma.durableWriteOperation.update({
    where: { id },
    data: {
      status,
      httpStatus,
      outcomeCode,
      errorCode,
      reconciliationStatus: unknown ? "REQUIRED" : "NOT_REQUIRED",
      leaseOwner: null,
      leaseUntil: null,
      finishedAt: unknown || status === "SUCCEEDED" || status === "FAILED" ? new Date() : null,
    },
  });
}

export async function markWriteReconciled({ id, status = "SUCCEEDED", owner } = {}) {
  const current = await prisma.durableWriteOperation.findUnique({ where: { id } });
  if (!current || current.status !== "OUTCOME_UNKNOWN") throw serviceError("WRITE_NOT_UNKNOWN", "Only unknown outcomes can be reconciled");
  if (owner && current.leaseOwner && current.leaseOwner !== owner) throw serviceError("WRITE_LEASE_INVALID", "Write lease is not owned by this worker");
  if (status !== "SUCCEEDED" && status !== "FAILED") throw serviceError("WRITE_RECONCILE_INVALID", "Reconciliation must resolve to success or failure");
  return prisma.durableWriteOperation.update({
    where: { id },
    data: { status, reconciliationStatus: "RESOLVED", leaseOwner: null, leaseUntil: null, finishedAt: new Date() },
  });
}

