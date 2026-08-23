/**
 * F02 Phase C smoke — analytics caps/SQL, pending clear, admin lazy shell.
 * Run: npm run test:f02c
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
    /Phase C — Improvements ✅/.test(f02),
    "F02 Phase C should be marked done"
  );

  const analytics = read("lib/services/analytics.service.js");
  assert(
    analytics.includes("ANALYTICS_SAMPLE_CAP") &&
      analytics.includes("sinceForRange") &&
      analytics.includes("groupBy"),
    "analytics must cap samples, bound 'all', and use SQL groupBy"
  );
  assert(
    !/const since = rangeInfo\.id === "all" \? null/.test(analytics),
    "dashboard loaders must not use unbounded since=null for 'all'"
  );
  console.log("ok  analytics caps + SQL aggregates");

  for (const rel of [
    "components/chat/ChatWorkspace.jsx",
    "components/conversations/ConversationThread.jsx",
    "components/studio/AgentTestStudio.jsx",
    "components/embed/PublicWebchat.jsx",
  ]) {
    const src = read(rel);
    assert(src.includes("optimisticId"), `${rel} must optimistic-send`);
    assert(src.includes("setSending(false)"), `${rel} must clear sending`);
  }
  console.log("ok  chat pending clear");

  const shared = read("components/analytics/analytics-shared.jsx");
  assert(
    shared.includes("keepPrevious") && shared.includes("enabled = true"),
    "useAnalyticsDashboard must support enabled + keepPrevious"
  );

  const admin = read("components/admin/AdminPlatformAnalytics.jsx");
  assert(
    admin.includes("getAdminOverview") &&
      admin.includes("chartsEnabled") &&
      admin.includes("shell"),
    "admin dashboard must shell-load overview and defer charts"
  );
  console.log("ok  admin lazy chart ranges");

  console.log("\nF02-C smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF02-C smoke FAILED:", error.message);
  process.exit(1);
}
