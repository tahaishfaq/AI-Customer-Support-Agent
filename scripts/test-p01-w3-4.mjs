/**
 * P1 W3-4 — structured ops logging (request id, agent id, duration; no transcript PII).
 * Builds on F01 observability — this smoke maps Week 3 "Logging" done-when.
 * Run: npm run test:p01-w3-4
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRequestId } from "../lib/observability/request-id.js";
import { safeLogError } from "../lib/observability/safe-log.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fakeRequest(headers = {}) {
  return {
    headers: {
      get(name) {
        const key = Object.keys(headers).find(
          (k) => k.toLowerCase() === name.toLowerCase()
        );
        return key ? headers[key] : null;
      },
    },
  };
}

function testSafeLogContract() {
  const safeLog = read("lib/observability/safe-log.js");
  assert(
    safeLog.includes("requestId") &&
      safeLog.includes("agentId") &&
      safeLog.includes("durationMs") &&
      safeLog.includes("safeLogInfoSampled"),
    "safe-log must allow requestId, agentId, durationMs + sampled success"
  );

  const originalError = console.error;
  let captured = "";
  console.error = (line) => {
    captured = String(line);
  };
  try {
    safeLogError("chatCompletion failed", {
      requestId: "rid-w34",
      agentId: "agent-w34",
      conversationId: "conv-w34",
      durationMs: 1200,
      code: "LLM_FAILED",
      prompt: "SECRET",
      message: "customer said hello",
      email: "a@b.com",
    });
    assert(captured.includes("rid-w34"), "failed chat log keeps requestId");
    assert(captured.includes("agent-w34"), "failed chat log keeps agentId");
    assert(captured.includes("durationMs"), "failed chat log keeps durationMs");
    assert(!captured.includes("customer said hello"), "must not log transcript");
    assert(!captured.includes("SECRET"), "must not log prompt");
    console.log("ok  failed chat log — no PII");
  } finally {
    console.error = originalError;
  }
}

function testChatPath() {
  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("runWithRequestContext") &&
      chat.includes("safeLogError(\"chatCompletion failed\"") &&
      chat.includes("safeLogInfoSampled"),
    "chat.service must use request context + structured fail/success logs"
  );

  const studio = read("app/api/agents/[id]/chat/route.js");
  const pub = read("app/api/public/agents/[publicKey]/chat/route.js");
  assert(
    studio.includes("durationHeaders") &&
      studio.includes("durationMsSince") &&
      studio.includes("agentId"),
    "studio chat route logs agentId + duration on 500"
  );
  assert(
    pub.includes("durationHeaders") &&
      pub.includes("durationMsSince") &&
      pub.includes("agentId"),
    "public chat route logs agentId + duration on 500"
  );
  console.log("ok  chat routes + service contracts");
}

function testClassifyCrawlPing() {
  const classify = read("lib/services/ai/classify.js");
  const ping = read("app/api/public/agents/[publicKey]/ping/route.js");
  const embed = read("lib/services/embed.service.js");
  const ctx = read("lib/observability/request-context.js");

  assert(
    classify.includes("resolveLogMeta") && ctx.includes("runWithRequestContext"),
    "classify inherits request context for fail logs"
  );
  assert(
    ping.includes("resolveRequestId") && ping.includes("safeLogError"),
    "public ping must log failures with request id"
  );
  assert(
    embed.includes("siteCrawl failed") &&
      embed.includes("requestId") &&
      embed.includes("agentId"),
    "crawl worker logs jobId + agentId + requestId"
  );
  console.log("ok  classify + crawl + ping contracts");
}

function testAnalyticsErrors() {
  const handle = read("app/api/analytics/handle-error.js");
  assert(
    handle.includes("resolveRequestId") && handle.includes("requestId"),
    "analytics errors must include requestId in ops logs"
  );
  console.log("ok  analytics error logs include requestId");
}

async function testLiveRequestId() {
  let health;
  try {
    health = await fetch(`${BASE}/api/health`);
  } catch {
    console.log("skip live HTTP (server not reachable)");
    return;
  }
  if (!health.ok) {
    console.log("skip live HTTP (health not ok)");
    return;
  }

  const customId = `w34-${Date.now()}`;
  const res = await fetch(`${BASE}/api/agents/fake-id/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": customId,
    },
    body: JSON.stringify({ message: "hello" }),
  });
  assert(
    res.headers.get("x-request-id") === customId,
    "studio chat 401 must echo x-request-id"
  );
  const body = await res.json();
  assert(body?.error?.message, "401 must use standard error shape");
  assert(
    !JSON.stringify(body).includes("hello"),
    "error response must not echo user message"
  );
  console.log("ok  live studio chat 401 + x-request-id");
}

async function main() {
  testSafeLogContract();
  testChatPath();
  testClassifyCrawlPing();
  testAnalyticsErrors();
  assert(
    resolveRequestId(fakeRequest({ "x-request-id": "w34-echo" })) === "w34-echo",
    "request-id echo"
  );
  console.log("ok  request-id echo");
  console.log("\nP1 W3-4 source smoke passed");
  await testLiveRequestId();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
