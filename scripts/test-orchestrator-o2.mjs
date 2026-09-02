/**
 * O01 Phase O2 — Capability Registry.
 * Run: npm run test:orchestrator-o2
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toCapabilityDescriptor } from "../lib/capabilities/descriptor.js";
import { actionsToOpenAiTools } from "../lib/actions/tool-definitions.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testFiles() {
  const files = [
    "lib/capabilities/registry.js",
    "lib/capabilities/descriptor.js",
    "lib/actions/tool-loop.js",
    "lib/actions/tool-definitions.js",
  ];
  for (const f of files) {
    assert(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
  const loop = fs.readFileSync(path.join(root, "lib/actions/tool-loop.js"), "utf8");
  assert(/listCapabilitiesForAgent/.test(loop), "tool-loop uses registry");
  assert(
    !/prisma\.agentAction\.findMany/.test(loop),
    "tool-loop must not query AgentAction directly for listing"
  );
  const registry = fs.readFileSync(
    path.join(root, "lib/capabilities/registry.js"),
    "utf8"
  );
  assert(/listEnabledMcpToolsForAgent/.test(registry), "registry loads MCP");
  assert(/toCapabilityDescriptor/.test(registry), "registry maps descriptors");
  const chat = fs.readFileSync(
    path.join(root, "lib/services/chat.service.js"),
    "utf8"
  );
  assert(/descriptors: enabledDescriptors/.test(chat), "chat passes descriptors");
  console.log("ok  O2 files + wiring");
}

function testHttpDescriptor() {
  const d = toCapabilityDescriptor({
    id: "act_1",
    name: "get_order",
    description: "Lookup order",
    inputSchemaJson: { orderId: "string" },
    riskLevel: "READ",
    accessClass: "GUEST",
    requiresIdentity: false,
    requiresConfirmation: false,
    identityMode: "NONE",
  });
  assert(d.kind === "http", "http kind");
  assert(d.sourceRef.type === "agent_action", "sourceRef");
  assert(d.name === "get_order", "name");
  assert(d.inputSchema && typeof d.inputSchema === "object", "schema");
  console.log("ok  HTTP → CapabilityDescriptor");
}

function testMcpDescriptor() {
  const d = toCapabilityDescriptor({
    id: "mcp_tool_1",
    name: "github_list_issues",
    description: "List issues",
    inputSchemaJson: { repo: "string" },
    riskLevel: "READ",
    requiresConfirmation: false,
    requiresIdentity: false,
    _mcp: { serverId: "s1", toolId: "mcp_tool_1" },
  });
  assert(d.kind === "mcp", "mcp kind");
  assert(d.sourceRef.type === "mcp_tool", "mcp sourceRef");
  console.log("ok  MCP → CapabilityDescriptor");
}

function testOpenAiToolsFromDescriptors() {
  const descriptors = [
    toCapabilityDescriptor({
      id: "a1",
      name: "get_order",
      description: "Get order",
      inputSchemaJson: { orderId: "string" },
      riskLevel: "READ",
    }),
    toCapabilityDescriptor({
      id: "m1",
      name: "mcp_search",
      description: "Search",
      inputSchemaJson: { q: "string" },
      riskLevel: "READ",
      _mcp: { serverId: "x" },
    }),
  ];
  const tools = actionsToOpenAiTools(descriptors);
  assert(tools.length === 2, "two tools");
  assert(tools[0].function.name === "get_order", "name 0");
  assert(tools[1].function.name === "mcp_search", "name 1");
  assert(
    tools[0].function.parameters?.properties?.orderId,
    "schema from inputSchema"
  );
  console.log("ok  actionsToOpenAiTools(descriptors)");
}

function main() {
  console.log("\n=== Orchestrator O2 ===\n");
  testFiles();
  testHttpDescriptor();
  testMcpDescriptor();
  testOpenAiToolsFromDescriptors();
  console.log("\nO2 PASS\n");
}

main();
