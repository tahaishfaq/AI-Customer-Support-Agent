/**
 * F02 Phase E smoke — classify after-return, pool sizing, crawl defer.
 * Run: npm run test:f02e
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

function main() {
  const f02 = featureDoc(root, "F02");
  assert(
    /Phase E — Production bottlenecks \(core\) ✅/.test(f02),
    "F02 Phase E should be marked done"
  );

  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes('from "next/server"') &&
      chat.includes("after(") &&
      chat.includes("insightsPending") &&
      chat.includes("CLASSIFY_AFTER_RETURN"),
    "chat must after()-classify with insightsPending lag flag"
  );
  assert(
    chat.includes("MAX_KNOWLEDGE_CHARS"),
    "KB stuffing soft cap must remain (F08 does smarter retrieval)"
  );
  console.log("ok  classify after-return + KB cap");

  const prisma = read("lib/prisma.js");
  assert(
    prisma.includes("PG_POOL_MAX") && /max:\s/.test(prisma),
    "prisma Pool must size max via PG_POOL_MAX / default 3"
  );
  console.log("ok  Neon pool sizing");

  const ping = read("app/api/public/agents/[publicKey]/ping/route.js");
  assert(
    ping.includes("CRAWL_DEFER_MS") && ping.includes("runCrawlJob"),
    "ping must defer crawl after enqueue"
  );
  console.log("ok  crawl defer");

  const analytics = read("lib/services/analytics.service.js");
  assert(
    analytics.includes("sinceForRange") && analytics.includes("ANALYTICS_SAMPLE_CAP"),
    "admin/product analytics must keep bounded range + sample cap"
  );

  const env = read(".env.example");
  assert(
    env.includes("PG_POOL_MAX") &&
      env.includes("CLASSIFY_AFTER_RETURN") &&
      env.includes("CRAWL_DEFER_MS") &&
      env.includes("-pooler"),
    ".env.example must document pool / classify / crawl / pooler"
  );
  console.log("ok  env contracts");

  console.log("\nF02-E smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF02-E smoke FAILED:", error.message);
  process.exit(1);
}
