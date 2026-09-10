import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { io } from "socket.io-client";

const port = 4204;
const origin = "http://localhost:3000";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await wait(100);
  }
  throw new Error("Timed out waiting for Phase 4 integration condition");
}

function nextEvent(socket, eventName, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);
    function onEvent(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      resolve(payload);
    }
    socket.on(eventName, onEvent);
  });
}

function emitEphemeral(socket, eventType, payload) {
  return new Promise((resolve) => {
    socket.emit("ephemeral:event", { eventType, payload }, resolve);
  });
}

async function join(socket, room) {
  return new Promise((resolve) => socket.emit("room:join", { room }, resolve));
}

async function main() {
  assert(process.env.REALTIME_REDIS_URL, "REALTIME_REDIS_URL is required");
  assert(process.env.REALTIME_TOKEN_SECRET, "REALTIME_TOKEN_SECRET is required");

  const [{ default: prisma }, sessionService, accessService] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/realtime/session.service.js"),
    import("../lib/realtime/public-access.service.js"),
  ]);

  let gateway;
  const sockets = [];
  const ownerSessions = [];
  let publicAccessId;
  let conversationId;
  let workspaceId;

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        agent: {
          enabled: true,
          user: { status: "ACTIVE" },
        },
      },
      select: {
        id: true,
        agentId: true,
        agent: { select: { userId: true, workspaceId: true, publicKey: true, embedEnabled: true } },
        humanTypingAt: true,
      },
    });
    assert(conversation, "An active owner conversation is required");
    assert(conversation.agent.embedEnabled, "Conversation agent must support public realtime test");
    conversationId = conversation.id;
    workspaceId = conversation.agent.workspaceId;

    const access = await accessService.createPublicConversationAccess({
      conversationId,
      origin,
      expiresAt: new Date(Date.now() + 60_000),
    });
    publicAccessId = access.id;
    const publicToken = await accessService.issuePublicRealtimeToken({
      rawAccessToken: access.rawToken,
      conversationId,
      agentId: conversation.agentId,
      origin,
    });

    const ownerA = await sessionService.issueOwnerRealtimeSession({
      userId: conversation.agent.userId,
      deviceLabel: `phase4-owner-a-${process.pid}`,
    });
    const ownerB = await sessionService.issueOwnerRealtimeSession({
      userId: conversation.agent.userId,
      deviceLabel: `phase4-owner-b-${process.pid}`,
    });
    ownerSessions.push(ownerA, ownerB);

    gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        REALTIME_ALLOWED_ORIGINS: origin,
        REALTIME_CONSUMER_GROUP: `phase4-${process.pid}-${Date.now()}`,
        REALTIME_CONSUMER_NAME: `phase4-${process.pid}`,
        REALTIME_TYPING_TTL_SECONDS: "1",
        REALTIME_TYPING_DEBOUNCE_MS: "50",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let gatewayErrors = "";
    gateway.stderr.on("data", (chunk) => { gatewayErrors += chunk.toString(); });

    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/readyz`)).ok;
      } catch {
        return false;
      }
    });

    for (const token of [ownerA.token, ownerB.token, publicToken.token]) {
      const socket = io(`http://127.0.0.1:${port}`, {
        auth: { token },
        transports: ["websocket"],
        extraHeaders: { Origin: origin },
        timeout: 10000,
      });
      sockets.push(socket);
      await once(socket, "connect");
    }
    const [ownerSocketA, ownerSocketB, publicSocket] = sockets;
    const ownerRoom = `conversation:${conversationId}:owner`;
    const publicRoom = `conversation:${conversationId}:public`;
    const deskRoom = `workspace:${workspaceId}:desk`;

    assert.deepEqual(await join(ownerSocketA, ownerRoom), { ok: true, room: ownerRoom });
    assert.deepEqual(await join(ownerSocketA, deskRoom), { ok: true, room: deskRoom });
    assert.deepEqual(await join(ownerSocketB, ownerRoom), { ok: true, room: ownerRoom });
    assert.deepEqual(await join(ownerSocketB, deskRoom), { ok: true, room: deskRoom });
    assert.deepEqual(await join(publicSocket, publicRoom), { ok: true, room: publicRoom });
    assert.equal((await join(publicSocket, ownerRoom)).ok, false);

    const beforeHumanTypingAt = conversation.humanTypingAt?.toISOString() || null;
    const startPayload = {
      conversationId,
      actorType: "OWNER",
      actorId: conversation.agent.userId,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    };
    const ownerReceived = nextEvent(ownerSocketB, "conversation.typing.started", (event) => event.payload?.conversationId === conversationId);
    const publicReceived = nextEvent(publicSocket, "conversation.typing.started", (event) => event.payload?.conversationId === conversationId);
    assert.deepEqual(await emitEphemeral(ownerSocketA, "conversation.typing.started", startPayload), { ok: true });
    await Promise.all([ownerReceived, publicReceived]);
    assert.equal((await prisma.conversation.findUnique({ where: { id: conversationId }, select: { humanTypingAt: true } })).humanTypingAt?.toISOString() || null, beforeHumanTypingAt);

    assert.equal((await emitEphemeral(ownerSocketA, "conversation.typing.started", {
      ...startPayload,
      actorType: "PUBLIC",
    })).ok, false);
    assert.equal((await emitEphemeral(ownerSocketA, "conversation.typing.started", {
      ...startPayload,
      conversationId: "another-conversation",
    })).ok, false);
    assert.equal((await emitEphemeral(publicSocket, "presence.updated", {
      workspaceId,
      userId: conversation.agent.userId,
      displayName: "forged",
      actorType: "OWNER",
      status: "online",
    })).ok, false);

    const presenceReceived = nextEvent(ownerSocketB, "presence.updated", (event) => event.payload?.userId === conversation.agent.userId);
    assert.deepEqual(await emitEphemeral(ownerSocketA, "presence.updated", {
      workspaceId,
      userId: conversation.agent.userId,
      displayName: "Owner",
      actorType: "OWNER",
      status: "online",
      conversationId,
    }), { ok: true });
    await presenceReceived;

    const publicTypingReceived = nextEvent(ownerSocketB, "conversation.typing.started", (event) => event.payload?.actorType === "PUBLIC");
    assert.deepEqual(await emitEphemeral(publicSocket, "conversation.typing.started", {
      conversationId,
      actorType: "PUBLIC",
      actorId: "customer-1",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    }), { ok: true });
    await publicTypingReceived;

    const ttlStopped = nextEvent(ownerSocketB, "conversation.typing.stopped", (event) => event.payload?.actorType === "PUBLIC", 5000);
    await ttlStopped;

    const disconnectStopped = nextEvent(ownerSocketB, "conversation.typing.stopped", (event) => event.payload?.actorType === "OWNER", 5000);
    await emitEphemeral(ownerSocketA, "conversation.typing.started", {
      ...startPayload,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    });
    ownerSocketA.disconnect();
    await disconnectStopped;

    if (gatewayErrors) console.error(gatewayErrors.trim());
    console.log("Phase 4.2 integration passed: ephemeral fan-out, ACLs, TTL, disconnect cleanup, and no DB typing writes.");
  } finally {
    for (const socket of sockets) socket.disconnect();
    for (const session of ownerSessions) {
      await sessionService.revokeRealtimeSession({
        userId: conversationId ? (await prisma.conversation.findUnique({ where: { id: conversationId }, select: { agent: { select: { userId: true } } } }))?.agent.userId : null,
        sessionId: session.sessionId,
      }).catch(() => {});
    }
    if (publicAccessId) await prisma.publicConversationAccess.delete({ where: { id: publicAccessId } }).catch(() => {});
    if (gateway && !gateway.killed) gateway.kill("SIGTERM");
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
