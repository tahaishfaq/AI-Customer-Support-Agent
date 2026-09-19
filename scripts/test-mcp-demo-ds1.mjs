/**
 * DS1 — demo MCP tool quality contracts.
 * Run: npm run test:mcp-demo-ds1
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  callDemoMcpTool,
  listDemoMcpTools,
  resolveDemoMcpToolName,
  DEMO_MCP_SERVER_INFO,
} from "../lib/mcp/demo-tools.js";
import { inferMcpToolRisk } from "../lib/mcp/client.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

assert.equal(DEMO_MCP_SERVER_INFO.version, "0.2.0");

const listed = listDemoMcpTools();
const names = listed.map((t) => t.name);
assert.equal(listed.length, 2, "tools/list is primary-only");
assert.ok(names.includes("aide_demo_get_time"));
assert.ok(names.includes("aide_demo_create_note"));
assert.ok(!names.includes("get_demo_time"));
assert.ok(!names.includes("create_demo_note"));

const primary = listed.find((t) => t.name === "aide_demo_get_time");
assert.equal(primary.annotations.readOnlyHint, true);
assert.equal(primary.annotations.idempotentHint, true);

const writeTool = listed.find((t) => t.name === "aide_demo_create_note");
assert.equal(writeTool.annotations.readOnlyHint, false);

assert.equal(resolveDemoMcpToolName("get_demo_time"), "aide_demo_get_time");
assert.equal(resolveDemoMcpToolName("aide_demo_create_note"), "aide_demo_create_note");

const okTime = callDemoMcpTool("aide_demo_get_time", { timezone: "UTC" });
assert.equal(okTime.isError, undefined);
assert.match(okTime.content[0].text, /Server time/);
assert.match(okTime.content[1].text, /aide_demo_mcp/);
assert.match(okTime.content[1].text, /"iso"/);

const legacy = callDemoMcpTool("get_demo_time", {});
assert.match(legacy.content[1].text, /aide_demo_get_time/);

const badTz = callDemoMcpTool("aide_demo_get_time", { timezone: "Not/AZone" });
assert.equal(badTz.isError, true);
assert.match(badTz.content[0].text, /Try timezone="UTC"/);
assert.doesNotMatch(badTz.content[0].text, /stack|Error:/i);

const missing = callDemoMcpTool("aide_demo_create_note", {});
assert.equal(missing.isError, true);
assert.match(missing.content[0].text, /text/);

const note = callDemoMcpTool("create_demo_note", { text: "  hello  " });
assert.match(note.content[1].text, /"hello"/);

assert.equal(inferMcpToolRisk("aide_demo_create_note").riskLevel, "WRITE");
assert.equal(inferMcpToolRisk("aide_demo_get_time").riskLevel, "READ");

const route = read("app/api/demo/mcp/route.js");
assert.match(route, /listDemoMcpTools/);
assert.match(route, /callDemoMcpTool/);

const panel = read("components/customization/McpServersPanel.jsx");
assert.match(panel, /aide_demo_get_time|get_demo_time/);
assert.match(panel, /filterMcpCatalog|openFromCatalog/);

console.log("mcp-demo-ds1: ok");
