/**
 * F13-T3 smoke — MCP schema, client, demo route, UI, tool-loop wiring.
 * Run: npm run test:f13t3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferMcpToolRisk,
  parseMcpHttpBody,
  sanitizeMcpFunctionName,
} from "../lib/mcp/client.js";

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
  const schema = read("prisma/schema.prisma");
  assert(/model AgentMcpServer\b/.test(schema), "schema AgentMcpServer");
  assert(/model AgentMcpTool\b/.test(schema), "schema AgentMcpTool");

  assert(
    exists("prisma/migrations/20260827120000_f13_mcp_servers/migration.sql"),
    "migration 20260827120000_f13_mcp_servers"
  );

  const client = read("lib/mcp/client.js");
  for (const name of [
    "probeMcpServer",
    "callMcpTool",
    "inferMcpToolRisk",
    "sanitizeMcpFunctionName",
  ]) {
    assert(
      new RegExp(`export (async )?function ${name}\\b`).test(client),
      `export ${name}`
    );
  }

  const createRisk = inferMcpToolRisk("create_demo_note");
  assert(
    createRisk.requiresConfirmation === true,
    "create_demo_note requiresConfirmation"
  );
  assert(createRisk.riskLevel === "WRITE", "create_demo_note WRITE");

  const getRisk = inferMcpToolRisk("get_demo_time");
  assert(getRisk.riskLevel === "READ", "get_demo_time READ");
  assert(getRisk.requiresConfirmation === false, "get_demo_time no confirm");

  assert(exists("app/api/demo/mcp/route.js"), "demo mcp route");
  assert(/get_demo_time/.test(read("app/api/demo/mcp/route.js")), "get_demo_time");

  const actionsForm = read("components/customization/ActionsForm.jsx");
  assert(/value="mcp"/.test(actionsForm), "MCP tab present");
  assert(/Coming soon/.test(actionsForm), "MCP tab Coming soon");
  assert(!/McpServersPanel/.test(actionsForm), "ActionsForm does not mount McpServersPanel");

  assert(exists("components/customization/McpServersPanel.jsx"), "McpServersPanel file kept");
  const mcpPanel = read("components/customization/McpServersPanel.jsx");
  assert(/Custom MCP server/.test(mcpPanel), "Custom MCP server");
  assert(/Use demo MCP/.test(mcpPanel), "Use demo MCP");

  const toolLoop = read("lib/actions/tool-loop.js");
  assert(
    /listEnabledMcpToolsForAgent/.test(toolLoop),
    "tool-loop listEnabledMcpToolsForAgent"
  );
  assert(/executeMcpToolAction/.test(toolLoop), "tool-loop executeMcpToolAction");

  for (const rel of [
    "app/api/agents/[id]/mcp-servers/route.js",
    "app/api/agents/[id]/mcp-servers/[serverId]/probe/route.js",
    "app/api/agents/[id]/mcp-servers/[serverId]/tools/[toolId]/route.js",
  ]) {
    assert(exists(rel), `missing ${rel}`);
  }

  // parseMcpHttpBody
  const jsonBody = parseMcpHttpBody(
    "application/json",
    JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } })
  );
  assert(jsonBody?.result?.ok === true, "parseMcpHttpBody JSON");

  const sseBody = parseMcpHttpBody(
    "text/event-stream",
    "event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"tools\":[]}}\n\n"
  );
  assert(Array.isArray(sseBody?.result?.tools), "parseMcpHttpBody SSE");

  let emptyThrew = false;
  try {
    parseMcpHttpBody("application/json", "   ");
  } catch {
    emptyThrew = true;
  }
  assert(emptyThrew, "parseMcpHttpBody empty throws");

  // sanitizeMcpFunctionName
  const fn = sanitizeMcpFunctionName("Demo Server!", "get_demo_time");
  assert(/^mcp_/.test(fn), "sanitize prefix");
  assert(/get_demo_time/.test(fn), "sanitize tool name");
  assert(fn.length <= 64, "sanitize max 64");
  assert(
    sanitizeMcpFunctionName("x", "A B") === "mcp_x_a_b" ||
      /mcp_x_a_b/.test(sanitizeMcpFunctionName("x", "A B")),
    "sanitize slugs"
  );

  const plan = read("docs/features/F13_TOOLS_HUB.md");
  assert(/Phase T3 — MCP \(deep\) ✅/.test(plan), "F13 plan marks T3 done");
  assert(
    /T0–T3 done|T0–T4 (done|complete|shipped)|Status:.*Shipped/i.test(plan),
    "F13 status includes T3+"
  );
  assert(
    /\[x\].*remote MCP server: discover \+ call 1 READ/.test(plan),
    "Done when MCP READ via demo checked"
  );

  console.log("ok  schema + migration AgentMcpServer/Tool");
  console.log("ok  mcp client exports + risk heuristics");
  console.log("ok  demo MCP + ActionsForm Coming soon + tool-loop");
  console.log("ok  API routes + parseMcpHttpBody / sanitizeMcpFunctionName");
  console.log("\nF13-T3 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF13-T3 smoke FAILED:", error.message);
  process.exit(1);
}
