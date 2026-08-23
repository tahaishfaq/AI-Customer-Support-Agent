/**
 * F01 Phase A smoke tests — request-id, safe logs, error shape.
 * Run with: node scripts/test-f01a.mjs
 * Optional live checks need: npm run dev (TEST_BASE_URL default http://127.0.0.1:3000)
 */
import { resolveRequestId } from "../lib/observability/request-id.js";
import { safeLog, safeLogError } from "../lib/observability/safe-log.js";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

function assert(ok, message) {
  if (!ok) throw new Error(message);
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

function testRequestId() {
  const generated = resolveRequestId(fakeRequest());
  assert(
    typeof generated === "string" && generated.length >= 8,
    "should generate request id"
  );

  const echoed = resolveRequestId(
    fakeRequest({ "x-request-id": "test-req-123" })
  );
  assert(echoed === "test-req-123", "should echo valid x-request-id");

  const rejected = resolveRequestId(
    fakeRequest({ "x-request-id": "bad id with spaces!!!" })
  );
  assert(rejected !== "bad id with spaces!!!", "should reject unsafe id");
  console.log("ok  request-id helper");
}

function testSafeLogStripsPii() {
  const originalError = console.error;
  let captured = "";
  console.error = (line) => {
    captured = String(line);
  };

  try {
    safeLogError("unit-test failure", {
      requestId: "rid-1",
      agentId: "agent-1",
      prompt: "SECRET_PROMPT",
      message: "SECRET_CHAT",
      email: "user@example.com",
      body: { password: "x" },
    });
    assert(captured.includes("rid-1"), "should keep requestId");
    assert(captured.includes("agent-1"), "should keep agentId");
    assert(!captured.includes("SECRET_PROMPT"), "must not log prompt");
    assert(!captured.includes("SECRET_CHAT"), "must not log message");
    assert(!captured.includes("user@example.com"), "must not log email");
    assert(!captured.includes("password"), "must not log body/password");
    console.log("ok  safe-log strips PII keys");
  } finally {
    console.error = originalError;
  }

  const originalInfo = console.info;
  let infoCount = 0;
  console.info = () => {
    infoCount += 1;
  };
  try {
    process.env.LOG_LEVEL = "error";
    safeLog("info", "should be dropped");
    assert(infoCount === 0, "LOG_LEVEL=error should drop info");
    console.log("ok  LOG_LEVEL filters info");
  } finally {
    delete process.env.LOG_LEVEL;
    console.info = originalInfo;
  }
}

async function testLiveHttp() {
  let health;
  try {
    health = await fetch(`${BASE}/api/health`);
  } catch {
    console.log("skip live HTTP (server not reachable at", BASE + ")");
    return;
  }
  if (!health.ok) {
    console.log("skip live HTTP (health not ok)");
    return;
  }

  const customId = `f01a-${Date.now()}`;
  const registerRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": customId,
    },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  const registerBody = await registerRes.json().catch(() => ({}));
  assert(
    registerRes.status === 400,
    `register validation should be 400 (got ${registerRes.status})`
  );
  assert(
    registerRes.headers.get("x-request-id") === customId,
    "register should echo x-request-id"
  );
  assert(
    registerBody?.error?.message === "Validation failed",
    "register error shape"
  );
  console.log("ok  register 400 + x-request-id");

  const chatRes = await fetch(
    `${BASE}/api/public/agents/does-not-exist-key/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": `${customId}-pub`,
      },
      body: JSON.stringify({ message: "hello" }),
    }
  );
  const chatBody = await chatRes.json().catch(() => ({}));
  assert(chatRes.status === 404, "missing public agent should be 404");
  assert(
    chatRes.headers.get("x-request-id") === `${customId}-pub`,
    "public chat should echo x-request-id"
  );
  assert(
    chatBody?.error?.message === "Agent not found",
    "public chat error shape"
  );
  console.log("ok  public chat 404 + x-request-id");

  const studioRes = await fetch(`${BASE}/api/agents/fake-id/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": `${customId}-studio`,
    },
    body: JSON.stringify({ message: "hello" }),
  });
  const studioBody = await studioRes.json().catch(() => ({}));
  assert(studioRes.status === 401, "studio chat without session should be 401");
  assert(
    studioRes.headers.get("x-request-id") === `${customId}-studio`,
    "studio chat 401 should echo x-request-id"
  );
  assert(
    studioBody?.error?.message,
    "studio chat 401 should have error.message"
  );
  console.log("ok  studio chat 401 + x-request-id");
}

async function main() {
  testRequestId();
  testSafeLogStripsPii();
  await testLiveHttp();
  console.log("\nF01-A smoke passed");
}

main().catch((error) => {
  console.error("\nF01-A smoke FAILED:", error.message);
  process.exit(1);
});
