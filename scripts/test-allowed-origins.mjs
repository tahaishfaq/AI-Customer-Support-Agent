/**
 * Allowed-origins gate contracts.
 * Run: npm run test:allowed-origins
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertAgentAllowedOrigin,
  evaluateAllowedOriginsGate,
  normalizeOriginEntry,
  parseAllowedOriginsList,
  readAllowedOriginsConfig,
} from "../lib/embed/allowed-origins.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

assert.equal(normalizeOriginEntry("https://Shop.Example.com/path"), "https://shop.example.com");
assert.equal(normalizeOriginEntry("http://localhost:3001"), "http://localhost:3001");
assert.deepEqual(parseAllowedOriginsList("https://a.com\nhttps://b.com, https://a.com"), [
  "https://a.com",
  "https://b.com",
]);

const allMode = readAllowedOriginsConfig({
  features: { allowedOriginsMode: "all", allowedOrigins: "https://evil.com" },
});
assert.equal(allMode.mode, "all");
assert.equal(evaluateAllowedOriginsGate({ mode: "all", list: allMode.list, requestOrigin: "https://any.com" }).ok, true);

const allow = readAllowedOriginsConfig({
  features: {
    allowedOriginsMode: "allowlist",
    allowedOrigins: "https://shop.example.com\nhttp://localhost:3001",
  },
});
assert.equal(allow.mode, "allowlist");
assert.equal(
  evaluateAllowedOriginsGate({
    mode: "allowlist",
    list: allow.list,
    requestOrigin: "https://shop.example.com",
  }).ok,
  true
);
assert.equal(
  evaluateAllowedOriginsGate({
    mode: "allowlist",
    list: allow.list,
    requestOrigin: "https://evil.example.com",
  }).reason,
  "origin_not_allowlisted"
);
assert.equal(
  evaluateAllowedOriginsGate({
    mode: "allowlist",
    list: allow.list,
    requestOrigin: null,
  }).reason,
  "origin_required"
);
assert.equal(
  evaluateAllowedOriginsGate({
    mode: "allowlist",
    list: [],
    requestOrigin: "https://shop.example.com",
  }).reason,
  "allowlist_empty"
);
assert.equal(
  evaluateAllowedOriginsGate({
    mode: "allowlist",
    list: allow.list,
    requestOrigin: "https://evil.example.com",
    skipReason: "localhost",
  }).ok,
  true
);

const denied = assertAgentAllowedOrigin(
  {
    customization: {
      features: {
        allowedOriginsMode: "allowlist",
        allowedOrigins: "https://shop.example.com",
      },
    },
  },
  { skip: false, origin: "https://other.com" }
);
assert.equal(denied.ok, false);

const embed = read("lib/services/embed.service.js");
assert.match(embed, /assertAgentAllowedOrigin/);
assert.match(read("components/customization/FeaturesForm.jsx"), /allowedOriginsMode/);

console.log("allowed-origins: ok");
