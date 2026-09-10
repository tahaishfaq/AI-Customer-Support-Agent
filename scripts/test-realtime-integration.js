import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import Redis from "ioredis";
import { io } from "socket.io-client";

async function main() {
const port = 4199;
const root = process.cwd();
const redis = new Redis(process.env.REALTIME_REDIS_URL, {
  username: process.env.REALTIME_REDIS_USERNAME || undefined,
  password: process.env.REALTIME_REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
});

const [{ default: prisma }, sessionService] = await Promise.all([
  import("../lib/prisma.js"),
  import("../lib/realtime/session.service.js"),
]);

let gateway;
let publisher;
let socket;
let sessionId;
let sessionUserId;
let gatewayErrors = "";
let publisherErrors = "";
let outboxId = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await wait(150);
  }
  throw new Error("Timed out waiting for realtime gateway");
}

try {
  assert(process.env.REALTIME_REDIS_URL, "REALTIME_REDIS_URL is required");
  assert(process.env.REALTIME_TOKEN_SECRET, "REALTIME_TOKEN_SECRET is required");

  const pong = await redis.ping();
  assert.equal(pong, "PONG");

  const schemaRows = await prisma.$queryRaw`
    SELECT
      to_regclass('public."RealtimeSession"')::text AS session_table,
      to_regclass('public."RealtimeOutboxEvent"')::text AS outbox_table,
      to_regclass('public."PublicConversationAccess"')::text AS public_access_table
  `;
  assert.equal(schemaRows[0].session_table, '"RealtimeSession"');
  assert.equal(schemaRows[0].outbox_table, '"RealtimeOutboxEvent"');
  assert.equal(schemaRows[0].public_access_table, '"PublicConversationAccess"');

  gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      REALTIME_ALLOWED_ORIGINS: "http://localhost:3000",
      REALTIME_CONSUMER_NAME: `integration-${process.pid}-${Date.now()}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  gateway.stderr.on("data", (chunk) => {
    gatewayErrors += chunk.toString();
  });

  await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/readyz`);
      return response.ok;
    } catch {
      return false;
    }
  });

  const user = await prisma.user.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  assert(user?.id, "An active user is required for gateway integration test");

  const issued = await sessionService.issueOwnerRealtimeSession({
    userId: user.id,
    deviceLabel: `integration-${process.pid}`,
  });
  sessionId = issued.sessionId;
  sessionUserId = user.id;

  socket = io(`http://127.0.0.1:${port}`, {
    auth: { token: issued.token },
    transports: ["websocket"],
    extraHeaders: { Origin: "http://localhost:3000" },
    timeout: 10000,
  });
  await once(socket, "connect");

  const joinResult = await new Promise((resolve) => {
    socket.emit("room:join", { room: `user:${user.id}` }, resolve);
  });
  assert.deepEqual(joinResult, { ok: true, room: `user:${user.id}` });

  const event = {
    eventId: randomUUID(),
    eventType: "billing.subscription.updated",
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    userId: user.id,
    workspaceId: null,
    agentId: null,
    conversationId: null,
    aggregateType: "subscription",
    aggregateVersion: 1,
    visibility: "OWNER",
    payload: {
      subscriptionId: "integration-subscription",
      status: "ACTIVE",
      planId: "integration-plan",
      currentPeriodEnd: null,
      action: "updated",
    },
  };
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Gateway did not fan out test event")), 10000);
    const onEvent = (receivedEvent) => {
      if (receivedEvent?.eventId !== event.eventId) return;
      clearTimeout(timer);
      socket.off("billing.subscription.updated", onEvent);
      resolve(receivedEvent);
    };
    socket.on("billing.subscription.updated", onEvent);
  });
  const outbox = await prisma.realtimeOutboxEvent.create({
    data: {
      eventId: event.eventId,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      visibility: event.visibility,
      userId: event.userId,
      aggregateType: event.aggregateType,
      aggregateVersion: event.aggregateVersion,
      payload: event.payload,
    },
    select: { id: true },
  });
  outboxId = outbox.id;

  // Publish only this fixture event. The shared database may contain older
  // unpublished rows from unrelated local runs; they must not delay this gate.
  publisher = spawn(process.execPath, ["workers/realtime-outbox-publisher.js"], {
    cwd: root,
    env: {
      ...process.env,
      REALTIME_CONSUMER_NAME: `publisher-${process.pid}`,
      REALTIME_PUBLISH_ONLY_EVENT_ID: event.eventId,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  publisher.stderr.on("data", (chunk) => {
    publisherErrors += chunk.toString();
  });

  const delivered = await received;
  assert.equal(delivered.eventId, event.eventId);
  await waitFor(async () => {
    const row = await prisma.realtimeOutboxEvent.findUnique({
      where: { id: outbox.id },
      select: { publishedAt: true },
    });
    return Boolean(row?.publishedAt);
  });
  await prisma.realtimeOutboxEvent.delete({ where: { id: outbox.id } });

  console.log("Realtime integration passed: migration, Redis, gateway auth, room join, stream fan-out.");
} catch (error) {
  if (gateway && !gateway.killed) {
    gateway.kill("SIGTERM");
  }
  if (publisher && !publisher.killed) publisher.kill("SIGTERM");
  if (gatewayErrors) console.error(gatewayErrors.trim());
  if (publisherErrors) console.error(publisherErrors.trim());
  throw error;
} finally {
  socket?.disconnect();
  if (sessionId && sessionUserId) {
    await sessionService.revokeRealtimeSession({
      userId: sessionUserId,
      sessionId,
    }).catch(() => {});
  }
  if (gateway && !gateway.killed) gateway.kill("SIGTERM");
  if (publisher && !publisher.killed) publisher.kill("SIGTERM");
  if (outboxId) {
    await prisma.realtimeOutboxEvent.delete({ where: { id: outboxId } }).catch(() => {});
  }
  await redis.quit().catch(() => {});
  await prisma.$disconnect?.().catch(() => {});
}

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
