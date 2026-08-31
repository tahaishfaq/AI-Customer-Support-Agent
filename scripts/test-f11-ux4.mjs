/**
 * F11 UX-4 smoke — vertical packs + OAuth seam + ActionsForm Integrations UI.
 * Run: npm run test:f11-ux4
 *
 * Note: do not import lib/integrations/action-pack.js in Node — it uses @/
 * aliases and pulls prisma. Assert ACTION_PACKS via source text (same as F11-R5).
 * vertical-packs.js and action-config.js are fine as relative imports.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  VERTICAL_PACKS,
  authBadgeLabel,
  getVerticalPack,
} from "../lib/integrations/vertical-packs.js";
import { ACTION_TEMPLATES } from "../lib/actions/action-config.js";
import { fetchClientCredentialsToken } from "../lib/integrations/oauth-client-credentials.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function main() {
  assert(VERTICAL_PACKS.length >= 5, "vertical registry");
  assert(getVerticalPack("brandly")?.featured, "Brandly featured");
  assert(getVerticalPack("shopify")?.auth === "oauth_soon", "Shopify oauth soon");
  assert(getVerticalPack("hubspot")?.auth === "oauth_soon", "HubSpot oauth soon");
  assert(authBadgeLabel("oauth_soon") === "OAuth soon");

  const packSrc = read("lib/integrations/action-pack.js");
  assert(
    /shopify_lite:\s*\[["']shopify_get_order["']\]/.test(packSrc),
    "shopify pack"
  );
  assert(
    /hubspot_lite:\s*\[["']hubspot_create_ticket["']\]/.test(packSrc),
    "hubspot pack"
  );
  assert(
    ACTION_TEMPLATES.some((t) => t.id === "shopify_get_order"),
    "shopify template"
  );
  assert(
    ACTION_TEMPLATES.some((t) => t.id === "hubspot_create_ticket"),
    "hubspot template"
  );

  try {
    await fetchClientCredentialsToken({});
    throw new Error("oauth should validate");
  } catch (err) {
    assert(err.code === "OAUTH_INVALID" || err.status === 400, "oauth seam");
  }

  const form = read("components/customization/ActionsForm.jsx");
  assert(
    /Coming soon/.test(form) || /Install Brandly/.test(form),
    "Integrations Coming soon or Install Brandly"
  );
  assert(
    /Coming soon/.test(form) || /OAuth \(SaaS\)/.test(form),
    "Integrations Coming soon or OAuth note"
  );
  assert(
    /Coming soon/.test(form) || /handleInstallVertical/.test(form),
    "Coming soon or vertical install handler"
  );

  const shipped = read("docs/SHIPPED_FEATURES.md");
  assert(/UX-4/.test(shipped), "SHIPPED documents UX-4");

  console.log("ok  UX-4 vertical pack registry");
  console.log("ok  shopify/hubspot packs + oauth seam");
  console.log("ok  ActionsForm Integrations (Coming soon)");
  console.log("\nF11 UX-4 smoke passed");
}

try {
  await main();
} catch (error) {
  console.error("\nF11 UX-4 smoke FAILED:", error.message);
  process.exit(1);
}
