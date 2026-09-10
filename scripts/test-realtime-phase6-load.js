import "dotenv/config";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";

const port = 4210;
const origin = "http://localhost:3000";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) { if (await check()) return; await wait(100); }
  throw new Error("Timed out waiting for Phase 6 load gateway");
}
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, { auth: { token }, transports: ["websocket"], extraHeaders: { Origin: origin }, timeout: 10_000 });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

async function main() {
  assert(process.env.REALTIME_REDIS_URL, "REALTIME_REDIS_URL is required");
  assert(process.env.REALTIME_TOKEN_SECRET, "REALTIME_TOKEN_SECRET is required");
  const [{ default: prisma }, sessionService] = await Promise.all([import("../lib/prisma.js"), import("../lib/realtime/session.service.js")]);
  const user = await prisma.user.findFirst({ where: { status: "ACTIVE" }, select: { id: true } });
  assert(user, "An active user is required");
  const session = await sessionService.issueOwnerRealtimeSession({ userId: user.id, deviceLabel: `phase6-load-${process.pid}` });
  const sockets = [];
  let gateway;
  try {
    gateway = spawn(process.execPath, ["realtime-gateway/test-server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), REALTIME_ALLOWED_ORIGINS: origin, REALTIME_MAX_CONNECTIONS_PER_USER: "20", REALTIME_CONSUMER_GROUP: `phase6-load-${process.pid}-${Date.now()}`, REALTIME_CONSUMER_NAME: `phase6-load-${process.pid}` }, stdio: ["ignore", "pipe", "pipe"] });
    await waitFor(async () => { try { return (await fetch(`http://127.0.0.1:${port}/readyz`)).ok; } catch { return false; } });
    for (let index = 0; index < 10; index += 1) sockets.push(await connect(session.token));
    const metrics = await (await fetch(`http://127.0.0.1:${port}/metrics`)).json();
    assert(metrics.activeConnections >= 10);
    assert(metrics.connectionsAccepted >= 10);
    for (const socket of sockets) socket.disconnect();
    await wait(250);
    const reconnects = await Promise.all(Array.from({ length: 10 }, () => connect(session.token)));
    assert.equal(reconnects.length, 10);
    for (const socket of reconnects) socket.disconnect();
    console.log("Phase 6 load passed: 10-device connection ramp and reconnect storm recovered within limits.");
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (gateway && !gateway.killed) gateway.kill("SIGTERM");
    await sessionService.revokeRealtimeSession({ userId: user.id, sessionId: session.sessionId }).catch(() => {});
    await prisma.$disconnect?.().catch(() => {});
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
