import { randomUUID } from "node:crypto";
import { buildRealtimeEvent } from "./events.js";

export async function enqueueRealtimeEvent(tx, input) {
  const event = buildRealtimeEvent(input);
  return tx.realtimeOutboxEvent.create({
    data: {
      eventId: event.eventId,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      visibility: event.visibility,
      userId: event.userId,
      workspaceId: event.workspaceId,
      agentId: event.agentId,
      conversationId: event.conversationId,
      aggregateType: event.aggregateType,
      aggregateVersion: event.aggregateVersion,
      payload: event.payload,
      availableAt: new Date(),
    },
  });
}

export async function claimRealtimeOutboxBatch(
  prisma,
  { owner = randomUUID(), limit = 50, leaseSeconds = 30 } = {}
) {
  const leaseUntil = new Date(Date.now() + leaseSeconds * 1000);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT *
      FROM "RealtimeOutboxEvent"
      WHERE "publishedAt" IS NULL
        AND "deadLetteredAt" IS NULL
        AND "availableAt" <= NOW()
        AND ("leaseUntil" IS NULL OR "leaseUntil" < NOW())
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    for (const row of rows) {
      await tx.realtimeOutboxEvent.update({
        where: { id: row.id },
        data: { leaseOwner: owner, leaseUntil, attempts: { increment: 1 } },
      });
    }
    return { owner, rows };
  });
}

export async function markRealtimeOutboxPublished(prisma, { id, owner }) {
  return prisma.realtimeOutboxEvent.updateMany({
    where: { id, leaseOwner: owner, publishedAt: null, deadLetteredAt: null },
    data: { publishedAt: new Date(), leaseOwner: null, leaseUntil: null, lastError: null },
  });
}

export async function markRealtimeOutboxFailure(
  prisma,
  { id, owner, error, retrySeconds = 30, deadLetter = false }
) {
  return prisma.realtimeOutboxEvent.updateMany({
    where: { id, leaseOwner: owner, publishedAt: null, deadLetteredAt: null },
    data: {
      lastError: String(error || "realtime publish failed").slice(0, 1000),
      availableAt: new Date(Date.now() + retrySeconds * 1000),
      leaseOwner: null,
      leaseUntil: null,
      ...(deadLetter ? { availableAt: new Date("9999-12-31T00:00:00.000Z") } : {}),
    },
  });
}

export async function markRealtimeOutboxDeadLettered(
  prisma,
  { id, owner, error }
) {
  return prisma.realtimeOutboxEvent.updateMany({
    where: { id, leaseOwner: owner, publishedAt: null, deadLetteredAt: null },
    data: {
      deadLetteredAt: new Date(),
      lastError: String(error || "realtime event moved to DLQ").slice(0, 1000),
      leaseOwner: null,
      leaseUntil: null,
    },
  });
}
