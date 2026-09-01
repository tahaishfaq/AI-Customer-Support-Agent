/**
 * O01 Phase O3 — Extract lib/orchestrator + thin channel.
 * Run: npm run test:orchestrator-o3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  stopReasonFromStep,
  stopReasonFromSteps,
  clientActionsFromSteps,
} from "../lib/orchestrator/stop-rules.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testFiles() {
  const files = [
    "lib/orchestrator/index.js",
    "lib/orchestrator/loop.js",
    "lib/orchestrator/stop-rules.js",
    "lib/orchestrator/map-policy.js",
    "lib/actions/invoke-tool.js",
    "lib/actions/tool-loop.js",
  ];
  for (const f of files) {
    assert(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
  console.log("ok  O3 module files");
}

function testWiring() {
  const orch = read("lib/orchestrator/index.js");
  assert(/export async function runTurn/.test(orch), "exports runTurn");
  assert(/runOrchestratorLoop/.test(orch), "delegates to loop");

  const loop = read("lib/orchestrator/loop.js");
  assert(/invokeOneTool/.test(loop), "loop invokes tools");
  assert(/stopReasonFromSteps/.test(loop), "loop uses stop rules");
  assert(!/executeHttpAction/.test(loop), "loop must not call HTTP directly");

  const toolLoop = read("lib/actions/tool-loop.js");
  assert(/listEnabledActionsForAgent|listCapabilitiesForAgent/.test(toolLoop), "tool-loop lists caps");
  assert(
    !/chatCompletionWithTools/.test(toolLoop),
    "deprecated chatCompletionWithTools must be removed (O5)"
  );
  assert(!/while \(stepsUsed/.test(toolLoop), "loop body left tool-loop");

  const chat = read("lib/services/chat.service.js");
  assert(/from "@\/lib\/orchestrator"/.test(chat), "chat imports orchestrator");
  assert(/runTurn\(/.test(chat), "chat calls runTurn");
  assert(!/executeHttpAction/.test(chat), "channel must not execute HTTP");
  assert(
    /streaming:\s*canTokenStream|flags\.streaming|onEvent/.test(chat),
    "O3.1: streaming + tools wired through runTurn"
  );
  assert(
    !/!enabledActions\.length/.test(chat) ||
      /canTokenStream = wantStream && !publicAccess/.test(chat),
    "O3.1: stream no longer requires empty tools"
  );

  const invoke = read("lib/actions/invoke-tool.js");
  assert(/export async function invokeOneTool/.test(invoke), "invoke exported");
  assert(/evaluateActionPolicy/.test(invoke), "policy still outside LLM");

  console.log("ok  O3 wiring + thin channel");
}

function testStopRules() {
  assert(stopReasonFromStep({ capabilityResult: { status: "needs_user" } }) === "needs_user");
  assert(stopReasonFromStep({ capabilityResult: { status: "escalate" } }) === "escalate");
  assert(stopReasonFromStep({ capabilityResult: { status: "ok" } }) === null);
  assert(
    stopReasonFromSteps([
      { capabilityResult: { status: "ok" } },
      { capabilityResult: { status: "needs_user" } },
    ]) === "needs_user"
  );
  assert(
    stopReasonFromSteps([
      { capabilityResult: { status: "escalate" } },
      { capabilityResult: { status: "needs_user" } },
    ]) === "needs_user",
    "needs_user wins"
  );

  const actions = clientActionsFromSteps([
    {
      capabilityResult: {
        forClient: { type: "confirm", payload: { id: "c1" } },
      },
    },
    {
      capabilityResult: {
        forClient: { type: "confirm", payload: { id: "c1" } },
      },
    },
    { capabilityResult: { forClient: { type: "none" } } },
    { capabilityResult: { forClient: { type: "login" } } },
  ]);
  assert(actions.length === 2, "dedupe confirm + keep login");
  assert(actions[0].type === "confirm");
  assert(actions[1].type === "login");
  console.log("ok  O3 stop-rules");
}

function testContractDoc() {
  const contract = read("docs/features/ORCHESTRATOR_CONTRACT.md");
  assert(/TurnResult/.test(contract), "contract documents TurnResult");
  assert(/stopReason/.test(contract), "contract has stopReason");
  const plan = read("docs/features/ORCHESTRATOR_LAYER_PLAN.md");
  assert(/O3/.test(plan), "plan has O3");
  console.log("ok  O3 docs mention TurnResult");
}

function main() {
  testFiles();
  testWiring();
  testStopRules();
  testContractDoc();
  console.log("\nAll O3 orchestrator checks passed.");
}

main();
