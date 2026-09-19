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
  assert(/syncCrawlKnowledge/.test(embed), "embed uses crawl knowledge sync");
  const crawlKnowledge = read("lib/services/crawl-knowledge.js");
  assert(
    /knowledgeDocument\.update/.test(crawlKnowledge),
    "recrawl updates existing WEB doc"
  );

  const agentVal = read("lib/validations/agent.js");
  assert(/crawlRecrawlHours/.test(agentVal), "agent validation");

  const knowledgeUi = read("components/knowledge/KnowledgeList.jsx");
  assert(/CrawlSchedulePanel/.test(knowledgeUi), "Knowledge UI schedule panel");
  assert(/Crawl site/.test(knowledgeUi), "Knowledge UI crawl site button");
  assert(/homepageUrl/.test(knowledgeUi), "Knowledge UI homepage URL field");
  assert(/retrySiteCrawl/.test(knowledgeUi), "Knowledge UI calls retry API");

  const retryRoute = read("app/api/agents/[id]/crawl/retry/route.js");
  assert(/retrySiteCrawlForAgent/.test(retryRoute), "crawl retry route");
  assert(/homepageUrl/.test(retryRoute), "crawl retry accepts homepageUrl");
  assert(/runCrawlJob/.test(retryRoute), "crawl retry runs job");

  const knowledgeSvc = read("lib/services/knowledge.service.js");
  assert(/force:\s*true/.test(knowledgeSvc), "owner retry forces enqueue");
  assert(/parseOwnerCrawlStartUrl/.test(knowledgeSvc), "owner homepage URL parse");

  const embedSvc = read("lib/services/embed.service.js");
  assert(/force === true/.test(embedSvc), "enqueueOneTimeCrawl force option");
  assert(/startUrl/.test(embedSvc), "enqueueOneTimeCrawl startUrl seed");

  const crawler = read("lib/services/site-crawler.js");
  assert(/parseOwnerCrawlStartUrl/.test(crawler), "parseOwnerCrawlStartUrl export");
  assert(/auth-path/.test(crawler), "blocks auth start paths");

  const scheduleUi = read("components/knowledge/CrawlSchedulePanel.jsx");
  assert(/CRAWL_RECRAWL_OPTIONS/.test(scheduleUi), "schedule select options");
  assert(/Once only/.test(scheduleUi), "once-only option");
  assert(/Scheduled refresh/.test(scheduleUi), "scheduled refresh option");

  const deployUi = read("components/customization/DeployForm.jsx");
  assert(/CrawlSchedulePanel/.test(deployUi), "Deploy tab schedule panel");

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
