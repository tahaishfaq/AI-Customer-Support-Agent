/**
 * Pack connection status — templates ≠ live connectors.
 * Run: npm run test:pack-status
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTION_TEMPLATES } from "../lib/actions/action-config.js";
import {
  PACK_CONNECTION_STATUS,
  classifyUrlConnectionStatus,
  connectionStatusLabel,
  packConnectionMeta,
  summarizePackConnectionStatus,
} from "../lib/integrations/pack-status.js";
import {
  VERTICAL_PACKS,
  getVerticalPack,
  verticalConnectionBadgeLabel,
} from "../lib/integrations/vertical-packs.js";
import { buildUniversalSlotTemplates, UNIVERSAL_BUSINESSES } from "../lib/integrations/universal-businesses.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testClassifier() {
  assert.equal(
    classifyUrlConnectionStatus("https://api.example.com/shopify/orders/{{id}}.json"),
    PACK_CONNECTION_STATUS.TEMPLATE
  );
  assert.equal(
    classifyUrlConnectionStatus("http://127.0.0.1:3000/api/demo/orders/{{id}}"),
    PACK_CONNECTION_STATUS.TEMPLATE
  );
  assert.equal(
    classifyUrlConnectionStatus("https://myshop.myshopify.com/admin/api/2024-01/orders/1.json"),
    PACK_CONNECTION_STATUS.UNVERIFIED
  );
  assert.equal(connectionStatusLabel("template"), "Template");
  assert.equal(connectionStatusLabel("unverified"), "Not connected");
  assert.notEqual(connectionStatusLabel("unverified"), "Connected");
  console.log("ok  URL classifier never claims Connected");
}

function testShopifyPackIsTemplate() {
  const shopify = getVerticalPack("shopify");
  assert.ok(shopify, "shopify vertical");
  assert.equal(shopify.connectionStatus, PACK_CONNECTION_STATUS.TEMPLATE);
  assert.equal(verticalConnectionBadgeLabel(shopify), "Template");
  assert.match(shopify.blurb, /not a connected|template/i);
  assert.doesNotMatch(shopify.blurb, /\blive\b.*\bstore\b/i);

  const tpl = ACTION_TEMPLATES.find((t) => t.id === "shopify_get_order");
  assert.ok(tpl, "shopify_get_order template");
  const meta = packConnectionMeta({
    packId: "shopify_lite",
    urls: [tpl.urlTemplate],
  });
  assert.equal(meta.connectionStatus, PACK_CONNECTION_STATUS.TEMPLATE);
  assert.equal(meta.isTemplate, true);
  assert.equal(meta.liveConnected, false);
  assert.equal(meta.connectionStatusLabel, "Template");
  console.log("ok  Shopify pack install metadata is Template / not live");
}

function testAllVerticalsAreTemplates() {
  assert.ok(
    VERTICAL_PACKS.every((p) => p.connectionStatus === PACK_CONNECTION_STATUS.TEMPLATE),
    "every vertical catalog entry is template"
  );
  assert.ok(
    VERTICAL_PACKS.every((p) => verticalConnectionBadgeLabel(p) === "Template"),
    "badges never say Connected"
  );
  console.log("ok  all vertical packs marked template");
}

function testUniversalSlotsAreTemplates() {
  const biz = UNIVERSAL_BUSINESSES[0];
  const slots = buildUniversalSlotTemplates(biz);
  const status = summarizePackConnectionStatus({
    urls: slots.map((s) => s.urlTemplate),
  });
  assert.equal(status, PACK_CONNECTION_STATUS.TEMPLATE);
  console.log("ok  universal business slots classify as template");
}

function testUiCopy() {
  const wizard = read("components/customization/UniversalBusinessWizard.jsx");
  assert.match(wizard, /Install template tools/);
  assert.match(wizard, /variant="secondary"[\s\S]*?Template/);
  assert.match(wizard, /not live-connected|does not connect a live/);
  assert.doesNotMatch(wizard, /Install suggested tools/);

  const deploy = read("components/customization/DeployForm.jsx");
  assert.match(deploy, /Install 6 template tools/);
  assert.match(deploy, /not live-connected/);

  const packApi = read("lib/integrations/action-pack.js");
  assert.match(packApi, /packConnectionMeta/);
  assert.match(packApi, /liveConnected/);
  console.log("ok  UI/API copy cannot imply live Shopify connection");
}

function main() {
  testClassifier();
  testShopifyPackIsTemplate();
  testAllVerticalsAreTemplates();
  testUniversalSlotsAreTemplates();
  testUiCopy();
  console.log("\npack-status smoke passed");
}

main();
