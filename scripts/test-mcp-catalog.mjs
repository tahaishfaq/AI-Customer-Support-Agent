/**
 * UX-2 — MCP catalog (Aide demo + Custom + GitHub only).
 * Run: npm run test:mcp-catalog
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MCP_CATALOG,
  filterMcpCatalog,
  getMcpCatalogEntry,
  listCommonMcpCatalog,
  listMcpCatalog,
} from "../lib/mcp/catalog.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const all = listMcpCatalog();
assert.equal(all.length, 3, "exactly 3 catalog entries");
assert.deepEqual(
  all.map((e) => e.id).sort(),
  ["aide-demo", "custom", "github"].sort()
);

const common = listCommonMcpCatalog();
assert.equal(common.length, 1);
assert.equal(common[0].id, "github");
assert.equal(common[0].authHint, "oauth");
assert.ok(common[0].defaultUrl);

assert.equal(getMcpCatalogEntry("notion"), null);
assert.equal(getMcpCatalogEntry("linear"), null);
assert.equal(getMcpCatalogEntry("stripe"), null);

assert.equal(filterMcpCatalog("git").length, 1);
assert.equal(filterMcpCatalog("git")[0].id, "github");
assert.equal(filterMcpCatalog("zzz").length, 0);

assert.ok(!MCP_CATALOG.some((e) => ["notion", "linear", "stripe"].includes(e.id)));

const panel = read("components/customization/McpServersPanel.jsx");
assert.match(panel, /filterMcpCatalog/);
assert.match(panel, /openFromCatalog/);
assert.match(panel, /Catalog/);
assert.doesNotMatch(panel, /Notion|Linear|Stripe/);

const catalogSrc = read("lib/mcp/catalog.js");
assert.match(catalogSrc, /github/);
assert.doesNotMatch(catalogSrc, /id:\s*"notion"/);
assert.doesNotMatch(catalogSrc, /id:\s*"linear"/);
assert.doesNotMatch(catalogSrc, /id:\s*"stripe"/);

console.log("mcp-catalog: ok");
