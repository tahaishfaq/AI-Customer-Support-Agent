import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { io } from "socket.io-client";

async function main() {
  const port = 4201;
  const root = process.cwd();
  const [{ default: prisma }, sessionService] = await Promise.all([
    import("../lib/prisma.js"),
    import("../lib/realtime/session.service.js"),
  ]);

  let gateway;
  const sockets = [];
  const sessionIds = [];
  let sessionUserId;
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
    throw new Error("Timed out waiting for realtime security test");
  }

  try {
    assert(process.env.REALTIME_REDIS_URL, "REALTIME_REDIS_URL is required");
    assert(process.env.REALTIME_TOKEN_SECRET, "REALTIME_TOKEN_SECRET is required");

    gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        REALTIME_ALLOWED_ORIGINS: "http://localhost:3000",
        REALTIME_CONSUMER_NAME: `security-${process.pid}-${Date.now()}`,
        REALTIME_HEARTBEAT_INTERVAL_SECONDS: "1",
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
    assert(user?.id, "An active user is required for realtime security test");
    sessionUserId = user.id;

    const issued = await Promise.all([
      sessionService.issueOwnerRealtimeSession({
        userId: user.id,
        deviceLabel: `security-device-a-${process.pid}`,
      }),
      sessionService.issueOwnerRealtimeSession({
        userId: user.id,
        deviceLabel: `security-device-b-${process.pid}`,
      }),
    ]);
    sessionIds.push(...issued.map((session) => session.sessionId));

    for (const session of issued) {
      const socket = io(`http://127.0.0.1:${port}`, {
        auth: { token: session.token },
        transports: ["websocket"],
        extraHeaders: { Origin: "http://localhost:3000" },
        timeout: 10000,
      });
      sockets.push(socket);
      await once(socket, "connect");
    }

    const userRoom = `user:${user.id}`;
    for (const socket of sockets) {
      const result = await new Promise((resolve) => {
        socket.emit("room:join", { room: userRoom }, resolve);
      });
      assert.deepEqual(result, { ok: true, room: userRoom });
    }

    const deniedRoom = `conversation:security-denied-${process.pid}:owner`;
    const denied = await new Promise((resolve) => {
      sockets[0].emit("room:join", { room: deniedRoom }, resolve);
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.error, "Room access denied");

    let secondDisconnected = false;
    sockets[1].once("disconnect", () => {
      secondDisconnected = true;
    });
    await sessionService.revokeRealtimeSession({
      userId: user.id,
      sessionId: issued[1].sessionId,
    });

    await waitFor(() => secondDisconnected, 15000);
    assert.equal(sockets[0].connected, true, "Revoking one device must not disconnect another");

    console.log(
      "Realtime Phase 2 security passed: multi-device sessions, room ACL, and per-session revocation."
    );
  } catch (error) {
    if (gatewayErrors) console.error(gatewayErrors.trim());
    throw error;
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (sessionUserId) {
      for (const sessionId of sessionIds) {
        await sessionService
          .revokeRealtimeSession({ userId: sessionUserId, sessionId })
          .catch(() => {});
      }
    }
    if (gateway && !gateway.killed) gateway.kill("SIGTERM");
    await prisma.$disconnect?.().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
