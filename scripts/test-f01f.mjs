/**
 * F01 Phase F smoke — request context + crawl requestId + dead-letter placeholder.
 * Run: npm run test:f01f
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testSource() {
  const schema = read("prisma/schema.prisma");
  assert(
    /model SiteCrawlJob[\s\S]*requestId\s+String\?/.test(schema),
    "SiteCrawlJob must have optional requestId"
  );

  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("runWithRequestContext"),
    "chat must wrap LLM+classify in request context"
  );

  const classify = read("lib/services/ai/classify.js");
  assert(
    classify.includes("resolveLogMeta"),
    "classify must resolve requestId from ALS/meta"
  );

  const embed = read("lib/services/embed.service.js");
  assert(
    embed.includes("requestId: requestId || null") ||
      embed.includes("requestId: requestId"),
    "enqueue crawl must persist requestId"
  );
  assert(
    embed.includes("enqueueDeadLetter"),
    "crawl fail must call dead-letter placeholder"
  );

  const ping = read("app/api/public/agents/[publicKey]/ping/route.js");
  assert(
    ping.includes("claimEmbedOrigin(agent.id, trustedOrigin,") &&
      ping.includes("runCrawlJob(result.jobId, { requestId })"),
    "ping must pass requestId into claim + crawl worker"
  );

  const dlq = read("lib/observability/dead-letter.js");
  assert(
    dlq.includes("enqueueDeadLetter") && dlq.includes("DLQ_HOOK_PLACEHOLDER"),
    "dead-letter placeholder module required"
  );

  console.log("ok  Phase F source contracts");
}

async function testRequestContext() {
  const { runWithRequestContext, getRequestContext, resolveLogMeta } =
    await import("../lib/observability/request-context.js");

  await runWithRequestContext(
    { requestId: "ctx-1", agentId: "a1", route: "studio-chat" },
    async () => {
      const ctx = getRequestContext();
      assert(ctx.requestId === "ctx-1", "ALS should expose requestId");
      const merged = resolveLogMeta({ conversationId: "c1" });
      assert(merged.requestId === "ctx-1", "resolveLogMeta inherits requestId");
      assert(merged.conversationId === "c1", "explicit meta wins/adds");
      const override = resolveLogMeta({ requestId: "explicit" });
      assert(override.requestId === "explicit", "explicit requestId wins");
    }
  );

  assert(
    !getRequestContext().requestId,
    "context should clear outside runWithRequestContext"
  );
  console.log("ok  request context ALS");
}

async function testDeadLetter() {
  const { enqueueDeadLetter } = await import(
    "../lib/observability/dead-letter.js"
  );
  const originalWarn = console.warn;
  let saw = "";
  console.warn = (line) => {
    saw += String(line);
  };
  try {
    await enqueueDeadLetter({
      jobType: "site-crawl",
      jobId: "job-1",
      requestId: "rid-1",
      agentId: "agent-1",
      code: "CRAWL_FAILED",
    });
    assert(saw.includes("dead-letter"), "should warn dead-letter");
    assert(saw.includes("rid-1"), "dead-letter should keep requestId");
    assert(!saw.includes("SECRET"), "no PII dump");
    console.log("ok  dead-letter placeholder log");
  } finally {
    console.warn = originalWarn;
  }
}

async function main() {
  testSource();
  await testRequestContext();
  await testDeadLetter();
  console.log("\nF01-F smoke passed");
}

main().catch((error) => {
  console.error("\nF01-F smoke FAILED:", error.message);
  process.exit(1);
});
