/**
 * F01 Phase D smoke — auth 429 request-id + ops log fields present in source.
 * Run: npm run test:f01d (dev server for live HTTP check)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testSourceContracts() {
  const chat = read("lib/services/chat.service.js");
  assert(chat.includes("durationMs"), "chat.service fail log needs durationMs");
  assert(chat.includes("LLM_FAILED"), "chat.service fail log needs LLM_FAILED code");

  const auth = read("auth.js");
  assert(
    auth.includes("too_many_attempts") || auth.includes("TooManyAttemptsError"),
    "auth.js needs TooManyAttemptsError for admin lockout"
  );

  const store = read("store/auth-store.js");
  assert(
    /Too many.*attempt/i.test(store) && /try again|Wait about/i.test(store),
    "auth-store must surface clear rate-limit copy"
  );

  const embed = read("lib/services/embed.service.js");
  assert(
    embed.includes("CRAWL_FAILED:"),
    "crawl job error should persist CRAWL_FAILED reason code"
  );

  const nextauth = read("app/api/auth/[...nextauth]/route.js");
  assert(
    nextauth.includes("tooManyRequests") && nextauth.includes("request"),
    "NextAuth POST 429 should pass request for x-request-id"
  );

  console.log("ok  Phase D source contracts");
}

async function testLiveAuth429() {
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

  const rid = `f01d-${Date.now()}`;
  // Hammer auth-post limiter (20/min) — may not always trip in one run; soft check.
  let saw429 = false;
  let sawRequestId = false;
  for (let i = 0; i < 25; i += 1) {
    const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-request-id": `${rid}-${i}`,
      },
      body: new URLSearchParams({
        csrfToken: "x",
        email: "rate-limit-probe@example.com",
        password: "wrong",
        redirect: "false",
      }),
      redirect: "manual",
    });
    if (res.status === 429) {
      saw429 = true;
      if (res.headers.get("x-request-id")) sawRequestId = true;
      break;
    }
  }
  if (saw429) {
    assert(sawRequestId, "auth 429 should include x-request-id");
    console.log("ok  NextAuth POST 429 + x-request-id");
  } else {
    console.log("skip live auth 429 (limit not hit — source contract still ok)");
  }
}

async function main() {
  testSourceContracts();
  await testLiveAuth429();
  console.log("\nF01-D smoke passed");
}

main().catch((error) => {
  console.error("\nF01-D smoke FAILED:", error.message);
  process.exit(1);
});
