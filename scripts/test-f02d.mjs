/**
 * F02 Phase D smoke — analytics busy timeout + OpenAI timeout/abort fallbacks.
 * Run: npm run test:f02d
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function testTimeoutHelper() {
  const {
    withAnalyticsTimeout,
    analyticsBusyError,
    isAnalyticsBusyError,
    ANALYTICS_BUSY_MESSAGE,
  } = await import("../lib/observability/analytics-timeout.js");

  assert(
    ANALYTICS_BUSY_MESSAGE.includes("shorter range"),
    "busy copy must mention shorter range"
  );
  assert(isAnalyticsBusyError(analyticsBusyError()), "503 busy is busy");
  assert(
    isAnalyticsBusyError({ code: "P1008", message: "timed out" }),
    "Prisma timeout should map to busy"
  );

  const started = Date.now();
  let threw = false;
  try {
    await withAnalyticsTimeout(
      new Promise((resolve) => setTimeout(resolve, 500)),
      50
    );
  } catch (error) {
    threw = true;
    assert(error.status === 503, "timeout should be 503");
    assert(
      error.message === ANALYTICS_BUSY_MESSAGE,
      "timeout message mismatch"
    );
  }
  assert(threw, "slow promise must reject");
  assert(Date.now() - started < 400, "timeout should fire early");
  console.log("ok  analytics timeout helper");
}

function testSource() {
  const f02 = featureDoc(root, "F02");
  assert(
    /Phase D — Error handling ✅/.test(f02),
    "F02 Phase D should be marked done"
  );

  const handle = read("app/api/analytics/handle-error.js");
  assert(
    handle.includes("ANALYTICS_BUSY_MESSAGE") && handle.includes("503"),
    "analytics handle-error must return 503 busy copy"
  );

  const analytics = read("lib/services/analytics.service.js");
  assert(
    analytics.includes("withAnalyticsTimeout"),
    "dashboard loaders must use withAnalyticsTimeout"
  );

  const llm = read("lib/services/ai/llm.provider.js");
  assert(
    llm.includes("isTimeoutError") &&
      llm.includes("isAbortError") &&
      llm.includes("signal"),
    "LLM provider must classify timeout/abort and accept signal"
  );

  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("TIMEOUT_ASSISTANT") &&
      chat.includes("CANCEL_ASSISTANT") &&
      chat.includes("never orphaned"),
    "chat must save timeout/cancel assistant so USER is not orphaned"
  );

  const studio = read("app/api/agents/[id]/chat/route.js");
  const pub = read("app/api/public/agents/[publicKey]/chat/route.js");
  assert(
    studio.includes("signal: request.signal") &&
      pub.includes("signal: request.signal"),
    "chat routes must pass request.signal"
  );

  const env = read(".env.example");
  assert(
    env.includes("ANALYTICS_TIMEOUT_MS") && env.includes("OPENAI_TIMEOUT_MS"),
    ".env.example must document analytics + OpenAI timeouts"
  );
  console.log("ok  Phase D source contracts");
}

async function main() {
  testSource();
  await testTimeoutHelper();
  console.log("\nF02-D smoke passed");
}

main().catch((error) => {
  console.error("\nF02-D smoke FAILED:", error.message);
  process.exit(1);
});
