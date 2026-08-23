/**
 * F04 Phase B smoke — studio hierarchy, hero declutter, site-stage preview.
 * Run: npm run test:f04b
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
  const f04 = featureDoc(root, "F04");
  assert(
    /Phase B — Design & functionality ✅/.test(f04),
    "F04 Phase B should be marked done"
  );

  const tabs = read("components/agents/studio-tabs.js");
  const order = [
    ...tabs.matchAll(/id:\s*"([^"]+)"/g),
  ].map((m) => m[1]);
  assert(
    order.join(",") ===
      "overview,knowledge,test,customization,analytics,conversations",
    `studio tab order wrong: ${order.join(",")}`
  );
  assert(/group:\s*"build"/.test(tabs) && /group:\s*"insights"/.test(tabs), "tab groups");

  const hero = read("components/agents/AgentHero.jsx");
  assert(!/FlaskConical/.test(hero), "hero should not duplicate Test CTA");
  assert(/Edit/.test(hero) && /Delete/.test(hero), "hero keeps Edit/Delete");
  assert(/showDivider|group === "insights"/.test(hero), "hero build/insights divider");

  const preview = read("components/customization/CustomizationPreview.jsx");
  assert(
    /yoursite\.com/.test(preview) && /siteChrome|siteBody|How the widget sits/.test(preview),
    "preview must look like a real site stage"
  );
  assert(
    !/linear-gradient\(180deg,#e8eef3/.test(preview),
    "toy gradient preview should be gone"
  );

  const dash = read("app/(app)/dashboard/page.jsx");
  assert(
    /tracking-wider text-\[var\(--color-primary\)\]/.test(dash) &&
      /\bHapy\b/.test(dash),
    "dashboard brand signal in first viewport"
  );
  assert(
    /aria-label="Workspace insights"/.test(dash),
    "dashboard insights section labeled"
  );
  const insightsIdx = dash.indexOf('aria-label="Workspace insights"');
  const shortcutsJsx = dash.indexOf("<DashboardShortcuts");
  assert(
    insightsIdx > 0 && shortcutsJsx > insightsIdx,
    "insights section before shortcuts in JSX"
  );

  console.log("ok  F04-B studio tab hierarchy");
  console.log("ok  hero declutter + site-stage preview + dashboard");
  console.log("\nF04-B smoke passed");
}

main();
