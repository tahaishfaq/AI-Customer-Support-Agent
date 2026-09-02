/**
 * P1 W3-5 — analytics SQL aggregates + composite index + classify after-return.
 * Run: npm run test:p01-w3-5
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

function main() {
  const analytics = read("lib/services/analytics.service.js");
  const sql = read("lib/services/analytics-sql.js");
  const chat = read("lib/services/chat.service.js");
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260830100000_conversation_agent_started/migration.sql"
  );

  assert(
    analytics.includes("buildDashboardAnalytics") &&
      analytics.includes("loadSqlCharts") &&
      analytics.includes("loadPlatformGrowthSql") &&
      !analytics.includes("loadPlatformGrowth("),
    "dashboard uses SQL chart path, not findMany growth"
  );
  assert(
    !/conversation\.findMany\(\{\s*\n\s*where,\s*\n\s*orderBy: \{ startedAt/.test(analytics),
    "dashboard must not load up to 8k conversation rows"
  );
  assert(
    sql.includes("$queryRaw") &&
      sql.includes("groupBy") &&
      sql.includes("loadExactKpis"),
    "analytics-sql must aggregate in SQL"
  );
  assert(
    sql.includes("loadPlatformGrowthSql") &&
      !sql.includes("user.findMany"),
    "platform growth uses SQL counts"
  );
  assert(
    /@@index\(\[agentId, startedAt\]\)/.test(schema) &&
      migration.includes("Conversation_agentId_startedAt_idx"),
    "composite agentId+startedAt index"
  );
  assert(
    chat.includes("after(") &&
      chat.includes("insightsPending") &&
      chat.includes("CLASSIFY_AFTER_RETURN"),
    "classify after-return default (does not block HTTP)"
  );

  console.log("ok  SQL dashboard aggregates");
  console.log("ok  no conversation findMany sample load");
  console.log("ok  platform growth SQL");
  console.log("ok  agentId+startedAt index");
  console.log("ok  classify after-return");
  console.log("\nP1 W3-5 smoke passed");
}

main();
