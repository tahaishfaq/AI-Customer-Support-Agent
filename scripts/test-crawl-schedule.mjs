/**
 * Scheduled website re-crawl — unit smoke.
 * Run: npm run test:crawl-schedule
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

async function testScheduleHelpers() {
  const {
    isRecrawlDue,
    nextRecrawlAt,
    normalizeCrawlRecrawlHours,
    CRAWL_RECRAWL_OPTIONS,
  } = await import("../lib/services/crawl-schedule.js");

  assert(CRAWL_RECRAWL_OPTIONS.length >= 4, "schedule options");
  assert(normalizeCrawlRecrawlHours(24) === 24, "24h allowed");
  assert(normalizeCrawlRecrawlHours(999) === 0, "invalid snaps to 0");

  const now = new Date("2026-08-23T12:00:00Z");
  const agentOnce = {
    crawlRecrawlHours: 0,
    siteCrawledAt: "2026-08-01T12:00:00Z",
  };
  assert(!isRecrawlDue(agentOnce, now), "0 hours never recrawls");

  const agentDaily = {
    crawlRecrawlHours: 24,
    siteCrawledAt: "2026-08-22T11:00:00Z",
  };
  assert(isRecrawlDue(agentDaily, now), "24h due after 25h");

  const agentDailyFresh = {
    crawlRecrawlHours: 24,
    siteCrawledAt: "2026-08-23T08:00:00Z",
  };
  assert(!isRecrawlDue(agentDailyFresh, now), "24h not due after 4h");

  const next = nextRecrawlAt(agentDailyFresh, now);
  assert(
    next?.toISOString() === "2026-08-24T08:00:00.000Z",
    `next recrawl ${next?.toISOString()}`
  );

  console.log("ok  crawl-schedule helpers");
}

function testSourceWiring() {
  const schema = read("prisma/schema.prisma");
  assert(/crawlRecrawlHours/.test(schema), "Agent.crawlRecrawlHours in schema");

  const embed = read("lib/services/embed.service.js");
  assert(/isRecrawlDue/.test(embed), "embed uses isRecrawlDue");
  assert(
    /knowledgeDocument\.update/.test(embed),
    "recrawl updates existing WEB doc"
  );

  const agentVal = read("lib/validations/agent.js");
  assert(/crawlRecrawlHours/.test(agentVal), "agent validation");

  const knowledgeUi = read("components/knowledge/KnowledgeList.jsx");
  assert(/CrawlSchedulePanel/.test(knowledgeUi), "Knowledge UI schedule panel");
  assert(/CRAWL_RECRAWL_OPTIONS/.test(knowledgeUi), "schedule select options");

  console.log("ok  crawl schedule source wiring");
}

async function main() {
  testSourceWiring();
  await testScheduleHelpers();
  console.log("PASS  crawl schedule smoke");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
