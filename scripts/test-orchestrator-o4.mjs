/**
 * O01 Phase O4a — Built-in capabilities (handoff + conversation meta).
 * Run: npm run test:orchestrator-o4
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILTIN_CAPABILITIES,
  listBuiltinActionsForAgent,
  isBuiltinAction,
} from "../lib/capabilities/builtins.js";
import { toCapabilityDescriptor } from "../lib/capabilities/descriptor.js";
import { capabilityResultFromToolStep } from "../lib/capabilities/from-tool-step.js";
import { TOOL_RUN_STATUS } from "../lib/actions/action-config.js";
import { actionsToOpenAiTools } from "../lib/actions/tool-definitions.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testFiles() {
  for (const f of [
    "lib/capabilities/builtins.js",
    "lib/capabilities/adapters/builtin.adapter.js",
    "lib/capabilities/registry.js",
  ]) {
    assert(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
  const registry = read("lib/capabilities/registry.js");
  assert(/listBuiltinActionsForAgent/.test(registry), "registry merges builtins");
  const invoke = read("lib/actions/invoke-tool.js");
  assert(/invokeBuiltinCapability/.test(invoke), "invoke routes builtins");
  assert(/isBuiltinAction/.test(invoke), "invoke detects builtins");
  const loop = read("lib/orchestrator/loop.js");
  assert(!/prisma\./.test(loop), "orchestrator loop has no Prisma/desk SQL");
  const orchIndex = read("lib/orchestrator/index.js");
  assert(!/prisma\./.test(orchIndex), "orchestrator index has no Prisma");
  console.log("ok  O4 files + wiring");
}

function testBuiltinDescriptors() {
  const names = BUILTIN_CAPABILITIES.map((b) => b.name);
  assert(names.includes("request_handoff"), "has request_handoff");
  assert(names.includes("get_conversation_meta"), "has get_conversation_meta");
  assert(!names.includes("search_knowledge"), "O4a skips search_knowledge (decision A)");

  const actions = listBuiltinActionsForAgent("agent_1");
  assert(actions.length === 2, "two synthetic actions");
  assert(actions.every((a) => isBuiltinAction(a)), "all marked builtin");
  assert(actions.every((a) => a.agentId === "agent_1"), "agent scoped");

  const d = toCapabilityDescriptor(actions[0]);
  assert(d.kind === "builtin", "descriptor kind builtin");
  assert(d.sourceRef.type === "builtin", "sourceRef builtin");

  const tools = actionsToOpenAiTools(actions);
  assert(tools.length === 2, "openai tools from builtins");
  assert(tools[0].function.name === "request_handoff");
  console.log("ok  O4 builtin descriptors");
}

function testHandoffMapsEscalate() {
  const step = {
    name: "request_handoff",
    status: TOOL_RUN_STATUS.OK,
    errorCode: "HANDOFF",
    durationMs: 5,
    resultForModel: '{"ok":true,"status":"escalated"}',
  };
  const r = capabilityResultFromToolStep(step);
  assert(r.status === "escalate", "HANDOFF → escalate");
  assert(r.forClient?.type === "handoff", "forClient handoff");
  console.log("ok  O4 HANDOFF → escalate");
}

function testChatHandlesToolEscalate() {
  const chat = read("lib/services/chat.service.js");
  assert(/toolEscalated/.test(chat), "chat detects tool escalate");
  assert(/handoff\?\.triggered/.test(chat), "chat reads handoff flag");
  console.log("ok  O4 chat escalate path");
}

function testDecisionADocs() {
  const plan = read("docs/features/ORCHESTRATOR_LAYER_PLAN.md");
  assert(/O4a|decision A|Knowledge stuffing/i.test(plan) || /O4/.test(plan));
  console.log("ok  O4 plan present");
}

function main() {
  testFiles();
  testBuiltinDescriptors();
  testHandoffMapsEscalate();
  testChatHandlesToolEscalate();
  testDecisionADocs();
  console.log("\nAll O4a orchestrator checks passed.");
}

main();
