import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { io } from "socket.io-client";

const port = 4207;
const origin = "http://localhost:3000";

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(check, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for load gateway");
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
    select: { id: true, humanTypingAt: true, agent: { select: { userId: true } } },
  });
  assert(conversation, "An active conversation is required");
  const before = conversation.humanTypingAt?.toISOString() || null;
  const session = await sessionService.issueOwnerRealtimeSession({
    userId: conversation.agent.userId,
    deviceLabel: `phase4-load-${process.pid}`,
  });
  let gateway;
  let socket;
  try {
    gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        REALTIME_ALLOWED_ORIGINS: origin,
        REALTIME_CONSUMER_GROUP: `phase4-load-${process.pid}-${Date.now()}`,
        REALTIME_CONSUMER_NAME: `phase4-load-${process.pid}`,
        REALTIME_EPHEMERAL_RATE_LIMIT_PER_MINUTE: "120",
        REALTIME_TYPING_TTL_SECONDS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitFor(async () => {
      try { return (await fetch(`http://127.0.0.1:${port}/readyz`)).ok; } catch { return false; }
    });
    socket = io(`http://127.0.0.1:${port}`, {
      auth: { token: session.token },
      transports: ["websocket"],
      extraHeaders: { Origin: origin },
    });
    await once(socket, "connect");
    const room = `conversation:${conversation.id}:owner`;
    await new Promise((resolve) => socket.emit("room:join", { room }, resolve));
    const startedAt = process.memoryUsage().rss;
    const results = await Promise.all(Array.from({ length: 500 }, (_, index) => new Promise((resolve) => {
      socket.emit("ephemeral:event", {
        eventType: "conversation.typing.started",
        payload: {
          conversationId: conversation.id,
          actorType: "OWNER",
          actorId: conversation.agent.userId,
          expiresAt: new Date(Date.now() + 10_000).toISOString(),
        },
      }, resolve);
    })));
    const accepted = results.filter((result) => result?.ok).length;
    const limited = results.filter((result) => result?.error === "Ephemeral event rate limit exceeded").length;
    assert.equal(accepted + limited, 500);
    assert(limited > 0, "Load test must exercise the per-connection limiter");
    await wait(1000);
    const after = process.memoryUsage().rss;
    const current = await prisma.conversation.findUnique({ where: { id: conversation.id }, select: { humanTypingAt: true } });
    assert.equal(current.humanTypingAt?.toISOString() || null, before);
    assert(after - startedAt < 32 * 1024 * 1024, "Ephemeral load grew gateway RSS unexpectedly");
    console.log(`Phase 4.4 load passed: 500 typing events, ${limited} rate-limited, no DB write, bounded RSS.`);
  } finally {
    socket?.disconnect();
    if (gateway && !gateway.killed) gateway.kill("SIGTERM");
    await sessionService.revokeRealtimeSession({ userId: conversation.agent.userId, sessionId: session.sessionId }).catch(() => {});
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
