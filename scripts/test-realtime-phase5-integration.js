import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import Redis from "ioredis";
import { io } from "socket.io-client";

const port = 4208;
const origin = "http://localhost:3000";

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(check, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for Phase 5 integration");
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      auth: { token },
      transports: ["websocket"],
      extraHeaders: { Origin: origin },
      timeout: 10000,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function waitForEvent(socket, eventType, eventId, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventType, onEvent);
      reject(new Error(`Timed out waiting for ${eventType}`));
    }, timeoutMs);
    function onEvent(event) {
      if (event?.eventId !== eventId) return;
      clearTimeout(timer);
      socket.off(eventType, onEvent);
      resolve(event);
    }
    socket.on(eventType, onEvent);
  });
}

async function main() {
  assert(process.env.REALTIME_REDIS_URL, "REALTIME_REDIS_URL is required");
  assert(process.env.REALTIME_TOKEN_SECRET, "REALTIME_TOKEN_SECRET is required");
  const [{ default: prisma }, sessionService] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/realtime/session.service.js"),
  ]);
  const redis = new Redis(process.env.REALTIME_REDIS_URL, {
    username: process.env.REALTIME_REDIS_USERNAME || undefined,
    password: process.env.REALTIME_REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
  });
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    take: 2,
  });
  assert.equal(users.length, 2, "Two active users are required for isolation test");
  const sessions = [];
  const sockets = [];
  let gateway;
  const stream = `aide:phase5:${process.pid}:${Date.now()}`;
  try {
    for (const user of users) {
      sessions.push(await sessionService.issueOwnerRealtimeSession({
        userId: user.id,
        deviceLabel: `phase5-${process.pid}-${user.id}`,
      }));
    }
    gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        REALTIME_ALLOWED_ORIGINS: origin,
        REALTIME_CONSUMER_GROUP: `phase5-${process.pid}-${Date.now()}`,
        REALTIME_CONSUMER_NAME: `phase5-${process.pid}`,
        REALTIME_STREAM_NAME: stream,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitFor(async () => {
      try { return (await fetch(`http://127.0.0.1:${port}/readyz`)).ok; } catch { return false; }
    });
    sockets.push(await connect(sessions[0].token));
    sockets.push(await connect(sessions[0].token));
    sockets.push(await connect(sessions[1].token));

    const subscriptionEvent = {
      eventId: `phase5-sub-${process.pid}-${Date.now()}`,
      eventType: "billing.subscription.updated",
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      userId: users[0].id,
      workspaceId: null,
      agentId: null,
      conversationId: null,
      aggregateType: "subscription",
      aggregateVersion: 10,
      visibility: "OWNER",
      payload: {
        subscriptionId: "phase5-subscription",
        status: "ACTIVE",
        planId: "phase5-plan",
        currentPeriodEnd: null,
        action: "updated",
      },
    };
    const user1a = waitForEvent(sockets[0], subscriptionEvent.eventType, subscriptionEvent.eventId);
    const user1b = waitForEvent(sockets[1], subscriptionEvent.eventType, subscriptionEvent.eventId);
    const user2 = waitForEvent(sockets[2], subscriptionEvent.eventType, subscriptionEvent.eventId, 1500)
      .then(() => { throw new Error("Billing event leaked across users"); })
      .catch((error) => {
        if (error.message === "Billing event leaked across users") throw error;
        return true;
      });
    await redis.xadd(stream, "*", "event", JSON.stringify(subscriptionEvent));
    await Promise.all([user1a, user1b, user2]);

    const quotaEvent = {
      ...subscriptionEvent,
      eventId: `phase5-quota-${process.pid}-${Date.now()}`,
      eventType: "billing.quota.updated",
      aggregateType: "conversation-quota",
      aggregateVersion: 11,
      payload: {
        periodStart: "2026-09-01T00:00:00.000Z",
        periodEnd: "2026-10-01T00:00:00.000Z",
        unlimited: false,
        used: 2,
        limit: 100,
        remaining: 98,
        planType: "FREE",
      },
    };
    const quotaReceived = waitForEvent(sockets[0], quotaEvent.eventType, quotaEvent.eventId);
    await redis.xadd(stream, "*", "event", JSON.stringify(quotaEvent));
    assert.equal((await quotaReceived).payload.remaining, 98);

    const invalidEvent = {
      ...subscriptionEvent,
      eventId: `phase5-invalid-${process.pid}-${Date.now()}`,
      payload: { subscriptionId: "secret-leak", status: "ACTIVE", planId: "phase5-plan", checkoutReference: "private" },
    };
    let invalidDelivered = false;
    const onInvalid = (event) => {
      if (event?.eventId === invalidEvent.eventId) {
        invalidDelivered = true;
      }
    };
    sockets[0].on(invalidEvent.eventType, onInvalid);
    await redis.xadd(stream, "*", "event", JSON.stringify(invalidEvent));
    await wait(1200);
    sockets[0].off(invalidEvent.eventType, onInvalid);
    assert.equal(invalidDelivered, false);

    console.log("Phase 5 integration passed: billing multi-device fan-out, user isolation, quota delivery, and malformed-event rejection.");
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (gateway && !gateway.killed) gateway.kill("SIGTERM");
    for (let index = 0; index < sessions.length; index += 1) {
      await sessionService.revokeRealtimeSession({ userId: users[index].id, sessionId: sessions[index].sessionId }).catch(() => {});
    }
    await redis.quit().catch(() => {});
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
