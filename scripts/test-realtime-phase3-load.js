import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import Redis from "ioredis";
import { io } from "socket.io-client";

async function main() {
  const port = 4203;
  const count = Math.min(Math.max(Number(process.env.REALTIME_PUBLIC_LOAD_CONNECTIONS) || 5, 2), 20);
  const root = process.cwd();
  const redis = new Redis(process.env.REALTIME_REDIS_URL, {
    username: process.env.REALTIME_REDIS_USERNAME || undefined,
    password: process.env.REALTIME_REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
  });
  const [{ default: prisma }, accessService] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/realtime/public-access.service.js"),
  ]);
  const sockets = [];
  const accessIds = [];
  let gateway;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(check, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await check()) return;
      await wait(100);
    }
    throw new Error("Timed out waiting for public realtime load test");
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: { agent: { publicKey: { not: null }, enabled: true, embedEnabled: true } },
      take: count,
      select: { id: true, agentId: true },
    });
    assert(conversations.length >= 1, "An enabled public conversation is required");

    gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        REALTIME_ALLOWED_ORIGINS: "http://localhost:3000",
        REALTIME_CONSUMER_GROUP: `phase3-load-${process.pid}-${Date.now()}`,
        REALTIME_CONSUMER_NAME: `phase3-load-${process.pid}`,
      },
      stdio: "ignore",
    });
    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/readyz`)).ok;
      } catch {
        return false;
      }
    });

    const targets = Array.from({ length: count }, (_, index) => conversations[index % conversations.length]);
    const clients = await Promise.all(
      targets.map(async (conversation) => {
        const access = await accessService.createPublicConversationAccess({
          conversationId: conversation.id,
          expiresAt: new Date(Date.now() + 60000),
        });
        accessIds.push(access.id);
        const issued = await accessService.issuePublicRealtimeToken({
          rawAccessToken: access.rawToken,
          conversationId: conversation.id,
          agentId: conversation.agentId,
          origin: "http://localhost:3000",
        });
        const socket = io(`http://127.0.0.1:${port}`, {
          auth: { token: issued.token },
          transports: ["websocket"],
          extraHeaders: { Origin: "http://localhost:3000" },
          timeout: 10000,
        });
        sockets.push(socket);
        await once(socket, "connect");
        const room = `conversation:${conversation.id}:public`;
        const joined = await new Promise((resolve) => socket.emit("room:join", { room }, resolve));
        assert.equal(joined.ok, true);
        return { socket, conversation };
      })
    );

    await Promise.all(
      clients.map(({ socket, conversation }) => {
        const event = {
          eventId: randomUUID(),
          eventType: "conversation.message.created",
          schemaVersion: 1,
          occurredAt: new Date().toISOString(),
          userId: null,
          workspaceId: null,
          agentId: conversation.agentId,
          conversationId: conversation.id,
          aggregateType: "conversation",
          aggregateVersion: 1,
          visibility: "PUBLIC",
          payload: { loadTest: true },
        };
        const received = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Public load event timeout")), 10000);
          const onEvent = (payload) => {
            if (payload?.conversationId !== conversation.id || !payload?.payload?.loadTest) return;
            clearTimeout(timer);
            socket.off(event.eventType, onEvent);
            resolve(payload);
          };
          socket.on(event.eventType, onEvent);
        });
        return redis
          .xadd(process.env.REALTIME_STREAM_NAME || "aide:realtime:events", "*", "event", JSON.stringify(event))
          .then(() => received);
      })
    );

    console.log(`Realtime Phase 3 public load passed: ${count} concurrent capability connections.`);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    for (const accessId of accessIds) {
      await prisma.publicConversationAccess.delete({ where: { id: accessId } }).catch(() => {});
    }
    if (gateway && !gateway.killed) gateway.kill("SIGTERM");
    await redis.quit().catch(() => {});
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
