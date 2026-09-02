/**
 * P1 W3-7 — responsive layout contracts (375px targets).
 * Run: npm run test:p01-w3-7
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
  const authLayout = read("app/(auth)/layout.jsx");
  assert(/hidden lg:block/.test(read("components/auth/AuthVisualPanel.jsx")), "marketing panel hidden mobile");
  assert(/min-h-0 sm:min-h-\[560px\]/.test(authLayout), "auth form natural height on mobile");
  assert(/px-4 py-6/.test(authLayout), "auth tighter padding mobile");

  const google = read("components/auth/GoogleSignInButton.jsx");
  assert(/min-h-10/.test(google), "google slot reserved height");
  assert(/Continue with Google unavailable/.test(google), "google error fallback");

  const hero = read("components/agents/AgentHero.jsx");
  assert(/overflow-x-auto/.test(hero), "studio tabs scroll on narrow");
  assert(/px-2\.5/.test(hero), "studio tab compact padding");

  const admin = read("components/admin/AdminPlatformAnalytics.jsx");
  assert(/grid-cols-2/.test(admin), "admin KPI 2-col mobile");
  assert(/min-w-0/.test(admin), "admin KPI cells truncate");

  const globals = read("app/globals.css");
  assert(/padding: 1rem 1rem 1\.5rem/.test(globals), "aide-page mobile padding");

  const metric = read("components/dashboard/MetricCard.jsx");
  assert(/truncate/.test(metric), "metric labels truncate");

  const analytics = read("components/analytics/analytics-shared.jsx");
  assert(/text-\[11px\].*sm:text-\[12px\]/.test(analytics), "range chips compact mobile");

  console.log("ok  auth + google mobile contracts");
  console.log("ok  studio tabs + admin KPI grid");
  console.log("ok  page padding + analytics chips");
  console.log("\nP1 W3-7 smoke passed");
}

main();
