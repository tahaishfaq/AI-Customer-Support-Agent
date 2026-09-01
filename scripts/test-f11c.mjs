/**
 * F11 chat tool loop smoke — definitions, wiring, schema validation.
 * Run: npm run test:f11c
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  actionsToOpenAiTools,
  inputSchemaToParameters,
  toolsPromptAddon,
  validateToolArgs,
} from "../lib/actions/tool-definitions.js";
import { MAX_TOOL_STEPS, TOOL_LOOP_DEADLINE_MS } from "../lib/actions/action-config.js";

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

function testDocScope() {
  const f11 = read("docs/features/F11_AGENT_ACTIONS.md");
  assert(
    /Chat tool loop ✅|Phase B.*tool loop ✅|tool loop.*✅/i.test(f11),
    "F11 tool loop should be marked done"
  );
  console.log("ok  F11-C doc scope");
}

function testSourceWiring() {
  const paths = [
    "lib/actions/tool-definitions.js",
    "lib/actions/tool-loop.js",
    "lib/services/ai/llm.provider.js",
    "lib/services/chat.service.js",
  ];
  for (const rel of paths) {
    assert(exists(rel), `missing: ${rel}`);
  }

  const chat = read("lib/services/chat.service.js");
  assert(/runTurn/.test(chat), "chat.service uses orchestrator runTurn");
  assert(/listEnabledActionsForAgent/.test(chat), "loads enabled actions");
  assert(/toolSteps/.test(chat), "returns toolSteps");

  const orch = read("lib/orchestrator/index.js");
  assert(/export async function runTurn/.test(orch), "orchestrator exports runTurn");

  const llm = read("lib/services/ai/llm.provider.js");
  assert(/chatCompletionTurn/.test(llm), "llm exposes chatCompletionTurn");
  assert(/tool_choice/.test(llm), "llm sends tool_choice");

  const bubble = read("components/chat/MessageBubble.jsx");
  assert(/toolSteps/.test(bubble) && /Called:/.test(bubble), "studio timeline under bubble");

  console.log("ok  F11-C source wiring");
}

function testDefinitions() {
  const params = inputSchemaToParameters({ orderId: "string" });
  assert(params.type === "object", "parameters object");
  assert(params.properties.orderId?.type === "string", "orderId string");
  assert(params.required.includes("orderId"), "orderId required");

  const tools = actionsToOpenAiTools([
    {
      name: "get_order_status",
      description: "Look up order",
      inputSchemaJson: { orderId: "string" },
    },
  ]);
  assert(tools.length === 1 && tools[0].type === "function", "openai tool shape");
  assert(tools[0].function.name === "get_order_status", "tool name");

  const ok = validateToolArgs({ orderId: "string" }, { orderId: "ORD-100" });
  assert(ok.ok && ok.args.orderId === "ORD-100", "valid args");

  const bad = validateToolArgs({ orderId: "string" }, {});
  assert(!bad.ok, "missing arg rejected");

  const fromJson = validateToolArgs(
    { orderId: "string" },
    JSON.stringify({ orderId: "ORD-100" })
  );
  assert(fromJson.ok, "JSON string args parsed");

  assert(MAX_TOOL_STEPS === 3, "max steps");
  assert(TOOL_LOOP_DEADLINE_MS === 25_000, "loop deadline");

  const addon = toolsPromptAddon(["get_order_status"]);
  assert(/get_order_status/.test(addon), "prompt addon lists tools");
  assert(toolsPromptAddon([]) === "", "empty addon when no tools");

  console.log("ok  F11-C definitions");
}

function main() {
  testDocScope();
  testSourceWiring();
  testDefinitions();
  console.log("\nAll F11-C checks passed.");
}

main();
