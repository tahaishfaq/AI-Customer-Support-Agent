/**
 * F02 Phase A smoke — scope & identity locked; hot-path files present.
 * Run: npm run test:f02a
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

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function main() {
  const f02 = featureDoc(root, "F02");
  assert(
    /Phase A — Scope & identity ✅/.test(f02),
    "F02 Phase A should be marked done"
  );
  assert(
    /analytics queries/i.test(f02) &&
      /chat latency perception/i.test(f02) &&
      /crawl\/job contention/i.test(f02) &&
      /rate limits/i.test(f02) &&
      /connection pooling/i.test(f02),
    "F02-A must list in-scope areas"
  );
  assert(
    /multi-region active-active/i.test(f02) && /Redis cluster/i.test(f02),
    "F02-A must name out-of-scope multi-region + Redis cluster"
  );
  assert(
    /Insights stay fresh/i.test(f02),
    "F02-A must keep classify / insights identity guardrail"
  );
  assert(
    f02.includes("lib/services/analytics.service.js") &&
      f02.includes("lib/services/chat.service.js") &&
      f02.includes("lib/prisma.js") &&
      f02.includes("lib/rate-limit.js") &&
      f02.includes("lib/services/embed.service.js"),
    "F02-A inventory must name hot-path files"
  );

  const hotPaths = [
    "lib/services/analytics.service.js",
    "lib/services/chat.service.js",
    "lib/services/ai/llm.provider.js",
    "lib/prisma.js",
    "lib/rate-limit.js",
    "lib/services/embed.service.js",
  ];
  for (const rel of hotPaths) {
    assert(exists(rel), `missing hot path: ${rel}`);
  }
  console.log("ok  F02-A doc scope + hot-path files");

  const env = read(".env.example");
  assert(
    env.includes("DATABASE_URL") && env.includes("DIRECT_URL"),
    ".env.example must document pooled DATABASE_URL + DIRECT_URL"
  );
  console.log("ok  Neon URL split still documented");

  console.log("\nF02-A smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF02-A smoke FAILED:", error.message);
  process.exit(1);
}
