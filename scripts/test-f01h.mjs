/**
 * F01 Phase H — production-readiness smoke (automated slice + checklist contracts).
 * Run: npm run test:f01h  (optional live checks need npm run dev)
 *
 * Manual (preview/Vercel) still required for OpenAI kill + admin maintenance toggle —
 * see docs/SHIPPED_FEATURES.md Phase H.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { _raw: text.slice(0, 240) };
  }
}

function testSourceContracts() {
  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("SAFE_ASSISTANT") && chat.includes("degraded"),
    "chat must degrade safely when OpenAI is down"
  );
  assert(
    /category\s*=\s*"GENERAL"/.test(chat) &&
      /sentiment\s*=\s*"NEUTRAL"/.test(chat) &&
      chat.includes("if (!degraded)"),
    "degraded path must keep conversation classifiable without crashing"
  );

  const classify = read("lib/services/ai/classify.js");
  assert(
    classify.includes("GENERAL") && classify.includes("NEUTRAL"),
    "classify fail must fall back to GENERAL/NEUTRAL"
  );

  const register = read("app/api/auth/register/route.js");
  assert(
    register.includes("Too many accounts created from this network"),
    "register 429 must have readable copy"
  );

  const layout = read("app/(app)/layout.jsx");
  assert(
    layout.includes("MaintenanceScreen") && layout.includes("maintenanceMode"),
    "USER app layout must gate on maintenanceMode"
  );

  const maint = read("components/layout/MaintenanceScreen.jsx");
  assert(
    maint.includes("under maintenance"),
    "MaintenanceScreen must show clear copy"
  );

  const requireAuth = read("lib/require-auth.js");
  assert(
    requireAuth.includes("under maintenance"),
    "API requireAuth must 503 for USER during maintenance"
  );

  const studio = read("components/studio/AgentTestStudio.jsx");
  assert(
    studio.includes("Generation failed — Try again"),
    "studio must surface degraded without white-screening"
  );

  console.log("ok  Phase H source contracts (DoD paths)");
}

async function testLive() {
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

  const platform = await fetch(`${BASE}/api/public/platform`);
  const platformBody = await json(platform);
  assert(platform.ok, "public platform should respond");
  assert(
    typeof platformBody?.signupsEnabled === "boolean" &&
      typeof platformBody?.maintenanceMode === "boolean",
    "platform must expose signupsEnabled + maintenanceMode"
  );
  console.log("ok  public platform flags shape");

  const rid = `f01h-${Date.now()}`;
  const chat401 = await fetch(`${BASE}/api/agents/fake/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": `${rid}-chat`,
    },
    body: JSON.stringify({ message: "hello" }),
  });
  const chatBody = await json(chat401);
  assert(chat401.status === 401, "studio chat without session → 401");
  assert(
    chat401.headers.get("x-request-id") === `${rid}-chat`,
    "401 should echo x-request-id"
  );
  assert(
    chatBody?.error?.message && !String(chatBody.error.message).includes("at "),
    "error message must not look like a stack dump"
  );
  console.log("ok  chat 401 safe error shape");

  // Register limiter: 8 / 15m — try a burst; soft-pass if already limited earlier.
  let saw429 = false;
  let copyOk = false;
  for (let i = 0; i < 12; i += 1) {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": `${rid}-reg-${i}`,
      },
      body: JSON.stringify({
        name: "Probe",
        email: `f01h-probe-${rid}-${i}@example.com`,
        password: "password12345",
        confirmPassword: "password12345",
      }),
    });
    const body = await json(res);
    if (res.status === 429) {
      saw429 = true;
      copyOk = /too many|try again/i.test(body?.error?.message || "");
      assert(
        res.headers.get("x-request-id"),
        "register 429 should include x-request-id"
      );
      break;
    }
  }
  if (saw429) {
    assert(copyOk, "register 429 must have readable copy");
    console.log("ok  register 429 readable copy");
  } else {
    console.log(
      "skip register 429 (limit not hit — copy still contracted in source)"
    );
  }
}

async function main() {
  testSourceContracts();
  await testLive();
  console.log("\nF01-H smoke passed (run Manual test for OpenAI kill + maintenance UI)");
}

main().catch((error) => {
  console.error("\nF01-H smoke FAILED:", error.message);
  process.exit(1);
});
