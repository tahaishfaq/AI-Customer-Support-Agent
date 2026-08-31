/**
 * P1 W3-6 — analytics CSV export (named gap: no chart rebuild).
 * Run: npm run test:p01-w3-6
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAgentsCsv,
  buildExport,
  buildSummaryCsv,
  buildTrendsCsv,
  csvEscape,
  exportFilename,
} from "../lib/analytics/export-csv.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  assert(csvEscape('say "hello"') === '"say ""hello"""', "csv escape quotes");

  const sample = {
    range: "7d",
    overview: {
      totalConversations: 12,
      totalMessages: 48,
      averageResponseTimeMs: 890,
      averageConversationLength: 4,
      positiveSentimentPercent: 50,
      negativeSentimentPercent: 8.3,
      mostCommonTopic: "SUPPORT",
    },
    agentCount: 2,
    activeAgents: 1,
    agents: [
      {
        name: "Support Bot",
        conversations: 12,
        percent: 100,
        messages: 48,
        averageResponseTimeMs: 890,
        positiveSentimentPercent: 50,
        negativeSentimentPercent: 8.3,
        mostCommonTopic: "SUPPORT",
        siteKnowledgeOrigin: "https://example.com",
      },
    ],
    trends: {
      points: [
        { date: "2026-08-24", label: "Mon", conversations: 4, messages: 16 },
        { date: "2026-08-25", label: "Tue", conversations: 8, messages: 32 },
      ],
    },
    topics: {
      distribution: [
        { category: "SUPPORT", label: "Support", count: 10, percent: 83.3 },
      ],
    },
    sentiment: {
      distribution: [
        { sentiment: "POSITIVE", label: "Positive", count: 6, percent: 50 },
      ],
    },
  };

  const summary = buildSummaryCsv(sample, { scope: "workspace", range: "7d" });
  assert(summary.includes("totalConversations") && summary.includes("12"), "summary csv");

  const agents = buildAgentsCsv(sample.agents);
  assert(agents.includes("Support Bot") && agents.includes("100"), "agents csv");

  const trends = buildTrendsCsv(sample.trends.points);
  assert(trends.includes("conversations") && trends.includes("2026-08-24"), "trends csv");

  assert(
    buildExport("topics", sample, { scope: "workspace", range: "7d" }).includes("Support"),
    "buildExport topics"
  );

  assert(
    exportFilename("workspace", "7d", "summary").startsWith("aide-analytics-workspace-7d-summary-"),
    "export filename"
  );

  for (const rel of [
    "components/analytics/AnalyticsExportMenu.jsx",
    "components/analytics/WorkspaceAnalytics.jsx",
    "components/analytics/AnalyticsBoard.jsx",
    "components/admin/AdminPlatformAnalytics.jsx",
  ]) {
    const src = read(rel);
    assert(src.includes("AnalyticsExportMenu"), `${rel} wires export menu`);
  }

  console.log("ok  csv builders");
  console.log("ok  summary + agents + trends");
  console.log("ok  export menu on product + admin analytics");
  console.log("\nP1 W3-6 smoke passed");
}

main();
