import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { io } from "socket.io-client";

const origin = "http://localhost:3000";
const ports = [4205, 4206];

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(check, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for cross-node gateway");
}

function event(socket, name, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), timeoutMs);
    socket.once(name, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function join(socket, room) {
  return new Promise((resolve) => socket.emit("room:join", { room }, resolve));
}

async function main() {
  assert(process.env.REALTIME_REDIS_URL, "REALTIME_REDIS_URL is required");
  assert(process.env.REALTIME_TOKEN_SECRET, "REALTIME_TOKEN_SECRET is required");
  const [{ default: prisma }, sessionService] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/realtime/session.service.js"),
  ]);
  const conversation = await prisma.conversation.findFirst({
    where: { agent: { user: { status: "ACTIVE" } } },
    select: { id: true, agent: { select: { userId: true } } },
  });
  assert(conversation, "An active conversation is required");
  const session = await sessionService.issueOwnerRealtimeSession({
    userId: conversation.agent.userId,
    deviceLabel: `phase4-cross-node-${process.pid}`,
  });
  const gateways = [];
  const sockets = [];
  try {
    const group = `phase4-cross-node-${process.pid}-${Date.now()}`;
    for (const port of ports) {
      const gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PORT: String(port),
          REALTIME_ALLOWED_ORIGINS: origin,
          REALTIME_CONSUMER_GROUP: group,
          REALTIME_CONSUMER_NAME: `${group}-${port}`,
          REALTIME_TYPING_TTL_SECONDS: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      gateways.push(gateway);
      await waitFor(async () => {
        try { return (await fetch(`http://127.0.0.1:${port}/readyz`)).ok; } catch { return false; }
      });
    }
    for (const port of ports) {
      const socket = io(`http://127.0.0.1:${port}`, {
        auth: { token: session.token },
        transports: ["websocket"],
        extraHeaders: { Origin: origin },
      });
      sockets.push(socket);
      await once(socket, "connect");
      assert.equal((await join(socket, `conversation:${conversation.id}:owner`)).ok, true);
    }
    const received = event(sockets[1], "conversation.typing.started");
    sockets[0].emit("ephemeral:event", {
      eventType: "conversation.typing.started",
      payload: {
        conversationId: conversation.id,
        actorType: "OWNER",
        actorId: conversation.agent.userId,
        expiresAt: new Date(Date.now() + 10_000).toISOString(),
      },
    }, (result) => assert.equal(result.ok, true));
    const payload = await received;
    assert.equal(payload.payload.conversationId, conversation.id);
    assert.equal(payload.payload.actorType, "OWNER");
    console.log("Phase 4.3 cross-node passed: Socket.IO Redis adapter fan-out across two gateways.");
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const gateway of gateways) if (!gateway.killed) gateway.kill("SIGTERM");
    await sessionService.revokeRealtimeSession({ userId: conversation.agent.userId, sessionId: session.sessionId }).catch(() => {});
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
