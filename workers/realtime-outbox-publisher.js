import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Redis from "ioredis";

const redisUrl = process.env.REALTIME_REDIS_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!redisUrl) throw new Error("REALTIME_REDIS_URL is required");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const streamName = process.env.REALTIME_STREAM_NAME || "aide:realtime:events";
const dlqStreamName = process.env.REALTIME_DLQ_STREAM_NAME || "aide:realtime:dlq";
const batchSize = Number(process.env.REALTIME_PUBLISH_BATCH_SIZE) || 50;
const leaseSeconds = Number(process.env.REALTIME_PUBLISH_LEASE_SECONDS) || 30;
const retryMaxSeconds = Number(process.env.REALTIME_RETRY_MAX_SECONDS) || 300;
const dlqAfterSeconds = Number(process.env.REALTIME_DLQ_AFTER_SECONDS) || 86400;
const streamMaxLen = Number(process.env.REALTIME_STREAM_MAXLEN) || 100000;
const owner = `publisher-${process.pid}-${randomUUID()}`;

const pool = new Pool({ connectionString: databaseUrl, max: 3, connectionTimeoutMillis: 10000 });
const redis = new Redis(redisUrl, {
  username: process.env.REALTIME_REDIS_USERNAME || undefined,
  password: process.env.REALTIME_REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

let stopping = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEvent(row) {
  if (!row.eventId || !row.eventType || !row.aggregateType || !row.visibility) {
    throw new Error("Invalid outbox event envelope");
  }
  return {
    eventId: row.eventId,
    eventType: row.eventType,
    schemaVersion: row.schemaVersion,
    occurredAt: new Date(row.createdAt).toISOString(),
    userId: row.userId,
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    conversationId: row.conversationId,
    aggregateType: row.aggregateType,
    aggregateVersion: row.aggregateVersion,
    visibility: row.visibility,
    payload: row.payload,
  };
}

async function claimBatch() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM "RealtimeOutboxEvent"
       WHERE "publishedAt" IS NULL
         AND "deadLetteredAt" IS NULL
         AND "availableAt" <= NOW()
         AND ("leaseUntil" IS NULL OR "leaseUntil" < NOW())
       ORDER BY "createdAt" ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );
    for (const row of rows) {
      await client.query(
        `UPDATE "RealtimeOutboxEvent"
            SET "leaseOwner" = $1,
                "leaseUntil" = NOW() + ($2 * INTERVAL '1 second'),
                "attempts" = "attempts" + 1
          WHERE id = $3`,
        [owner, leaseSeconds, row.id]
      );
    }
    await client.query("COMMIT");
    return rows;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function publish(row) {
  const event = parseEvent(row);
  await redis.xadd(
    streamName,
    "MAXLEN", "~", String(streamMaxLen), "*",
    "eventId", event.eventId,
    "event", JSON.stringify(event)
  );
}

async function markPublished(id) {
  await pool.query(
    `UPDATE "RealtimeOutboxEvent"
        SET "publishedAt" = NOW(), "leaseOwner" = NULL, "leaseUntil" = NULL, "lastError" = NULL
      WHERE id = $1 AND "leaseOwner" = $2 AND "publishedAt" IS NULL`,
    [id, owner]
  );
}

async function markFailure(row, error) {
  const ageSeconds = (Date.now() - new Date(row.createdAt).getTime()) / 1000;
  const message = String(error?.message || "realtime publish failed").slice(0, 1000);
  if (ageSeconds >= dlqAfterSeconds) {
    await redis.xadd(
      dlqStreamName,
      "MAXLEN", "~", String(streamMaxLen), "*",
      "eventId", row.eventId,
      "error", message,
      "event", JSON.stringify(row.payload)
    );
    await pool.query(
      `UPDATE "RealtimeOutboxEvent"
          SET "deadLetteredAt" = NOW(), "lastError" = $1, "leaseOwner" = NULL, "leaseUntil" = NULL
        WHERE id = $2 AND "leaseOwner" = $3`,
      [message, row.id, owner]
    );
    return;
  }
  const retrySeconds = Math.min(retryMaxSeconds, 2 ** Math.min(Number(row.attempts) || 1, 8));
  await pool.query(
    `UPDATE "RealtimeOutboxEvent"
        SET "lastError" = $1,
            "availableAt" = NOW() + ($2 * INTERVAL '1 second'),
            "leaseOwner" = NULL,
            "leaseUntil" = NULL
      WHERE id = $3 AND "leaseOwner" = $4`,
    [message, retrySeconds, row.id, owner]
  );
}

async function loop() {
  let retryMs = 1000;
  while (!stopping) {
    try {
      const rows = await claimBatch();
      retryMs = 1000;
      if (!rows.length) {
        await sleep(500);
        continue;
      }
      for (const row of rows) {
        try {
          await publish(row);
          await markPublished(row.id);
        } catch (error) {
          try {
            await markFailure(row, error);
          } catch (markError) {
            console.error("[realtime-publisher] failure-state retry", {
              message: markError.message,
              eventId: row.eventId,
            });
          }
        }
      }
    } catch (error) {
      if (stopping) break;
      console.error("[realtime-publisher] loop retrying", { message: error.message, retryMs });
      await sleep(retryMs);
      retryMs = Math.min(30_000, retryMs * 2);
    }
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  await redis.quit().catch(() => {});
  await pool.end().catch(() => {});
  console.log(`[realtime-publisher] stopped after ${signal}`);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

loop().catch(async (error) => {
  console.error("[realtime-publisher] fatal", { message: error.message });
  await shutdown("fatal");
  process.exitCode = 1;
});
