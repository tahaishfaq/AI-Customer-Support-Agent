/**
 * F13-T1 smoke — Tools tabs: Integrations · MCP · HTTP.
 * Integrations + MCP are EmptyState "Coming soon"; default tab is HTTP.
 * Run: npm run test:f13t1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  VERTICAL_PACKS,
  filterVerticalPacks,
  groupVerticalPacksByCategory,
  isVerticalInstalled,
  partitionVerticalPacks,
} from "../lib/integrations/vertical-packs.js";

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
  assert(VERTICAL_PACKS[0]?.id === "site_demo", "Site demo first");
  assert(VERTICAL_PACKS[1]?.id === "brandly", "Brandly second");
  assert(
    VERTICAL_PACKS.every((p) => Array.isArray(p.actionNames) && p.actionNames.length),
    "every vertical has actionNames"
  );

  assert(!isVerticalInstalled(VERTICAL_PACKS[0], []));
  assert(
    isVerticalInstalled(VERTICAL_PACKS[0], [{ name: "list_items" }]),
    "site demo installed detection"
  );
  assert(
    isVerticalInstalled(VERTICAL_PACKS[1], [{ name: "list_brandly_campaigns" }]),
    "brandly installed detection"
  );

  const filtered = filterVerticalPacks(VERTICAL_PACKS, "brand");
  assert(
    filtered.some((p) => p.id === "brandly") &&
      !filtered.some((p) => p.id === "shopify"),
    "search filters packs"
  );

  const { enabled, available } = partitionVerticalPacks(VERTICAL_PACKS, [
    { name: "list_items" },
  ]);
  assert(enabled.some((p) => p.id === "site_demo"), "partition enabled");
  assert(available.some((p) => p.id === "brandly"), "partition available");

  const form = read("components/customization/ActionsForm.jsx");
  assert(/value="integrations"/.test(form), "Integrations tab");
  assert(/value="mcp"/.test(form), "MCP tab");
  assert(/value="http"/.test(form), "HTTP tab");
  assert(!/value="connection"/.test(form), "no Connection top-level tab");
  assert(!/value="capabilities"/.test(form), "no Capabilities top-level tab");
  assert(!/value="advanced"/.test(form), "no Advanced top-level tab");
  assert(/Coming soon/.test(form), "Integrations/MCP Coming soon");
  assert(/EmptyState/.test(form), "EmptyState import usage");
  assert(!/McpServersPanel/.test(form), "MCP tab does not mount McpServersPanel");
  assert(!/Search integrations/.test(form), "no pack search UI");
  assert(!/>Connection</.test(form), "no Connection collapsible in UI");
  assert(/setTab\("http"\)/.test(form), "openCreate/Edit → HTTP");
  assert(/useState\("http"\)/.test(form), "default HTTP tab");

  const grouped = groupVerticalPacksByCategory(VERTICAL_PACKS);
  assert(grouped[0]?.category === "Demo", "Demo category first");
  assert(
    grouped.some((g) => g.category === "Marketplace"),
    "Marketplace category"
  );

  assert(exists("components/customization/McpServersPanel.jsx"), "McpServersPanel file kept");

  const plan = read("docs/features/F13_TOOLS_HUB.md");
  assert(/T1/.test(plan) && /done|✅/.test(plan), "F13 plan marks T1");

  console.log("ok  vertical category helpers");
  console.log("ok  ActionsForm tabs · Coming soon · default HTTP");
  console.log("\nF13-T1 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF13-T1 smoke FAILED:", error.message);
  process.exit(1);
}
