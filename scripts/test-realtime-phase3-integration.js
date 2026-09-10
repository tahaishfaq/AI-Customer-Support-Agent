import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import Redis from "ioredis";
import { io } from "socket.io-client";

async function main() {
  const port = 4202;
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

  let gateway;
  let socket;
  let accessId;
  let gatewayErrors = "";

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(check, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await check()) return;
      await wait(150);
    }
    throw new Error("Timed out waiting for public realtime integration");
  }

  try {
    assert(process.env.REALTIME_REDIS_URL, "REALTIME_REDIS_URL is required");
    assert(process.env.REALTIME_TOKEN_SECRET, "REALTIME_TOKEN_SECRET is required");

    const conversation = await prisma.conversation.findFirst({
      where: { agent: { publicKey: { not: null }, enabled: true, embedEnabled: true } },
      select: { id: true, agentId: true },
    });
    assert(conversation, "An enabled public conversation is required");

    const origin = "http://localhost:3000";
    const access = await accessService.createPublicConversationAccess({
      conversationId: conversation.id,
      origin,
      expiresAt: new Date(Date.now() + 60000),
    });
    accessId = access.id;
    const tokenResult = await accessService.issuePublicRealtimeToken({
      rawAccessToken: access.rawToken,
      conversationId: conversation.id,
      agentId: conversation.agentId,
      origin,
    });

    gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        REALTIME_ALLOWED_ORIGINS: origin,
        REALTIME_CONSUMER_GROUP: `phase3-${process.pid}-${Date.now()}`,
        REALTIME_CONSUMER_NAME: `phase3-${process.pid}`,
        REALTIME_HEARTBEAT_INTERVAL_SECONDS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    gateway.stderr.on("data", (chunk) => {
      gatewayErrors += chunk.toString();
    });

    await waitFor(async () => {
      try {
        return (await fetch(`http://127.0.0.1:${port}/readyz`)).ok;
      } catch {
        return false;
      }
    });

    socket = io(`http://127.0.0.1:${port}`, {
      auth: { token: tokenResult.token },
      transports: ["websocket"],
      extraHeaders: { Origin: origin },
      timeout: 10000,
    });
    await once(socket, "connect");

    const publicRoom = `conversation:${conversation.id}:public`;
    const joinResult = await new Promise((resolve) => {
      socket.emit("room:join", { room: publicRoom }, resolve);
    });
    assert.deepEqual(joinResult, { ok: true, room: publicRoom });

    const ownerJoin = await new Promise((resolve) => {
      socket.emit("room:join", { room: `conversation:${conversation.id}:owner` }, resolve);
    });
    assert.equal(ownerJoin.ok, false);
    assert.equal(ownerJoin.error, "Room access denied");

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
      payload: { messageId: "phase3-public-test", role: "HUMAN", content: "Hello" },
    };
    const received = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Public event was not delivered")), 10000);
      socket.once(event.eventType, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
    await redis.xadd(
      process.env.REALTIME_STREAM_NAME || "aide:realtime:events",
      "*",
      "event",
      JSON.stringify(event)
    );
    assert.equal((await received).eventId, event.eventId);

    let disconnected = false;
    socket.once("disconnect", () => {
      disconnected = true;
    });
    await prisma.publicConversationAccess.update({
      where: { id: access.id },
      data: { revokedAt: new Date() },
    });
    await waitFor(() => disconnected, 15000);

    console.log(
      "Realtime Phase 3 integration passed: public room ACL, safe fan-out, and capability revocation."
    );
  } catch (error) {
    if (gatewayErrors) console.error(gatewayErrors.trim());
    throw error;
  } finally {
    socket?.disconnect();
    if (accessId) {
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
