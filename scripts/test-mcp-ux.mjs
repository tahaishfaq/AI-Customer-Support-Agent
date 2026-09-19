/**
 * M01 UX-1 closeout — MCP tab + draft probe contracts.
 * Run: npm run test:mcp-ux
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const form = read("components/customization/ActionsForm.jsx");
assert.match(form, /McpServersPanel/);
assert.doesNotMatch(form, /MCP servers will land here/);

const panel = read("components/customization/McpServersPanel.jsx");
assert.match(panel, /probeDraftAgentMcpServer/);
assert.match(panel, /Test connection/);
assert.match(panel, /Needs confirm/);
assert.match(panel, /mention them in agent instructions/);

const svc = read("lib/services/mcp.service.js");
assert.match(svc, /probeDraftMcpServerForAgent/);
assert.match(svc, /never accepts plaintext secrets in the body/);
assert.doesNotMatch(svc, /data\.secret|body\.secret|plaintextSecret/);

const route = read("app/api/agents/[id]/mcp-servers/probe-draft/route.js");
assert.match(route, /probeDraftMcpServerForAgent/);
assert.match(route, /probeDraftMcpServerSchema/);

const api = read("lib/api/mcp.js");
assert.match(api, /probeDraftAgentMcpServer/);

const val = read("lib/validations/mcp.js");
assert.match(val, /probeDraftMcpServerSchema/);

console.log("mcp-ux: ok");
