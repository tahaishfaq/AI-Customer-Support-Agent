/**
 * F13-T0 smoke — site_demo_v1 pack + helpers + UI contracts.
 * Run: npm run test:f13t0
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTION_TEMPLATES } from "../lib/actions/action-config.js";
import {
  SITE_DEMO_ACTION_NAMES,
  SITE_DEMO_PACK_ID,
  isSiteDemoInstalled,
  siteDemoInstallCopy,
} from "../lib/integrations/site-demo-pack.js";
import { getVerticalPack } from "../lib/integrations/vertical-packs.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  assert(SITE_DEMO_PACK_ID === "site_demo_v1");
  assert(SITE_DEMO_ACTION_NAMES.length === 6, "six starter action names");
  assert(!isSiteDemoInstalled([]));
  assert(isSiteDemoInstalled([{ name: "list_items" }]));
  assert(/Install 6 starter tools/.test(siteDemoInstallCopy("acme.com")));

  for (const name of SITE_DEMO_ACTION_NAMES) {
    assert(
      ACTION_TEMPLATES.some((t) => t.name === name),
      `template for ${name}`
    );
  }
  const ticket = ACTION_TEMPLATES.find((t) => t.name === "create_lead_or_ticket");
  assert(ticket?.requiresConfirmation === true, "ticket needs confirm");
  const pref = ACTION_TEMPLATES.find((t) => t.name === "update_preference");
  assert(
    pref?.requiresConfirmation && pref?.requiresIdentity,
    "preference needs confirm + identity"
  );

  const packSrc = read("lib/integrations/action-pack.js");
  assert(/site_demo_v1:/.test(packSrc), "ACTION_PACKS site_demo_v1");
  assert(/resolvePackUrlTemplate/.test(packSrc), "demo URL rewrite on install");

  assert(getVerticalPack("site_demo")?.packIds?.includes("site_demo_v1"));

  for (const rel of [
    "app/api/demo/items/route.js",
    "app/api/demo/items/[id]/route.js",
    "app/api/demo/help/route.js",
    "app/api/demo/tickets/route.js",
    "app/api/demo/preferences/route.js",
  ]) {
    assert(exists(rel), `missing ${rel}`);
  }

  const actionsForm = read("components/customization/ActionsForm.jsx");
  assert(/Coming soon/.test(actionsForm), "Integrations/MCP Coming soon");
  assert(/useState\("http"\)/.test(actionsForm), "default HTTP tab");

  const deploy = read("components/customization/DeployForm.jsx");
  assert(/SITE_DEMO_PACK_ID/.test(deploy), "Deploy install prompt");
  assert(/Install 6 starter tools/.test(deploy), "Deploy CTA");

  const studio = read("components/customization/CustomizationStudio.jsx");
  assert(/label: "Tools"/.test(studio), "Tools section label");

  const plan = read("docs/features/F13_TOOLS_HUB.md");
  assert(/T0/.test(plan), "F13 plan");

  console.log("ok  F13-T0 site_demo_v1 templates + pack");
  console.log("ok  demo API routes");
  console.log("ok  Tools UI Coming soon + Deploy install prompt");
  console.log("\nF13-T0 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF13-T0 smoke FAILED:", error.message);
  process.exit(1);
}
