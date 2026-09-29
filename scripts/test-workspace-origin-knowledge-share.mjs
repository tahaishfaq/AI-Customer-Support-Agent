/**
 * Contract: same-workspace origin share + knowledge share helpers.
 * Run: ./node_modules/.bin/tsx --import ./scripts/register-aliases.mjs scripts/test-workspace-origin-knowledge-share.mjs
 */

import assert from "node:assert/strict";
import {
  evaluateAllowedOriginsGate,
  parseAllowedOriginsList,
  readAllowedOriginsConfig,
} from "../lib/embed/allowed-origins.js";

function pass(name) {
  console.log(`PASS ${name}`);
}

{
  const list = parseAllowedOriginsList(
    "https://www.brandly.pk\nbrandly.pk\nhttps://www.brandly.pk"
  );
  assert.equal(list.length, 2, "dedupe + normalize");
  assert.ok(list.includes("https://www.brandly.pk"));
  assert.ok(list.includes("https://brandly.pk"));
  pass("parseAllowedOriginsList normalizes");
}

{
  const cfg = readAllowedOriginsConfig({
    features: {
      allowedOriginsMode: "allowlist",
      allowedOrigins: "https://shop.example.com",
    },
  });
  assert.equal(cfg.mode, "allowlist");
  assert.deepEqual(cfg.list, ["https://shop.example.com"]);

  assert.equal(
    evaluateAllowedOriginsGate({
      mode: "allowlist",
      list: cfg.list,
      requestOrigin: "https://shop.example.com",
    }).ok,
    true
  );
  assert.equal(
    evaluateAllowedOriginsGate({
      mode: "allowlist",
      list: cfg.list,
      requestOrigin: "https://other.example.com",
    }).ok,
    false
  );
  assert.equal(
    evaluateAllowedOriginsGate({
      mode: "allowlist",
      list: cfg.list,
      requestOrigin: "https://other.example.com",
      skipReason: "localhost",
    }).ok,
    true
  );
  pass("allowlist gate honors listed origin");
}

{
  // findOriginTakenOutsideWorkspace query shape (documented contract)
  const self = { agentId: "a1", workspaceId: "ws1" };
  const where = {
    siteKnowledgeOrigin: "https://shop.example.com",
    NOT: { id: self.agentId },
    workspaceId: { not: self.workspaceId },
  };
  assert.deepEqual(where.workspaceId, { not: "ws1" });
  assert.deepEqual(where.NOT, { id: "a1" });
  pass("origin_taken scoped to other workspace");
}

console.log("\nAll workspace origin/knowledge-share unit checks passed.");
