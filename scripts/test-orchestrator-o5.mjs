/**
 * O01 Phase O5 — Harden: no wrappers, security gates, CI fixtures.
 * Run: npm run test:orchestrator-o5
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCapabilityResult } from "../lib/capabilities/result.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testNoDeprecatedWrapper() {
  const toolLoop = read("lib/actions/tool-loop.js");
  assert(
    !/chatCompletionWithTools/.test(toolLoop),
    "chatCompletionWithTools must be deleted"
  );
  const chat = read("lib/services/chat.service.js");
  assert(/runTurn/.test(chat), "channel uses runTurn");
  assert(!/chatCompletionWithTools/.test(chat), "channel must not call wrapper");
  console.log("ok  O5 wrapper removed");
}

function testSecurityGates() {
  const chat = read("lib/services/chat.service.js");
  assert(!/executeHttpAction/.test(chat), "O-T08: chat never imports http-executor");
  assert(!/from "@\/lib\/actions\/http-executor"/.test(chat), "no http-executor import");

  const loop = read("lib/orchestrator/loop.js");
  assert(!/executeHttpAction/.test(loop), "orchestrator loop no direct HTTP");
  assert(!/prisma\./.test(loop), "orchestrator loop no Prisma");
  assert(/evaluateActionPolicy/.test(read("lib/actions/invoke-tool.js")), "policy still PEP");

  const invoke = read("lib/actions/invoke-tool.js");
  assert(
    /evaluateActionPolicy/.test(invoke) && /isBuiltinAction/.test(invoke),
    "HTTP/MCP go through policy; builtins gated separately"
  );
  // Builtins skip confirm — intentional; HTTP still confirms
  assert(/isBuiltinAction\(action\)/.test(invoke), "builtin early route present");
  console.log("ok  O5 security gates (no policy bypass for HTTP)");
}

function testObservability() {
  const orch = read("lib/orchestrator/index.js");
  assert(/stopReason/.test(orch), "logs stopReason");
  assert(/capabilityCount/.test(orch), "logs capability counts");
  assert(/orchestrator\.turn/.test(orch), "structured turn event");

  const safeLog = read("lib/observability/safe-log.js");
  assert(/stopReason/.test(safeLog), "stopReason allowlisted");
  assert(/capabilityCount/.test(safeLog), "capabilityCount allowlisted");
  console.log("ok  O5 observability");
}

function testFixturesStillValid() {
  const dir = path.join(root, "scripts/fixtures/orchestrator");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert(files.length >= 5, "fixture set present");
  for (const f of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const v = validateCapabilityResult(raw);
    assert(v.ok, `${f}: ${v.error}`);
  }
  console.log("ok  O5 contract fixtures");
}

function testDocsAndScripts() {
  const pkg = JSON.parse(read("package.json"));
  assert(pkg.scripts["test:orchestrator"], "test:orchestrator script");
  assert(pkg.scripts["test:orchestrator-o5"], "test:orchestrator-o5 script");

  const ci = read(".github/workflows/ci.yml");
  assert(/test:orchestrator/.test(ci), "CI runs orchestrator suite");

  const shipped = read("package.json");
  assert(
    /test:orchestrator/.test(shipped) &&
      /test:shipped/.test(shipped) &&
      /test:orchestrator/.test(
        JSON.parse(shipped).scripts["test:shipped"] || ""
      ),
    "test:shipped includes orchestrator"
  );

  const arch = read("docs/features/ARCHITECTURE_ACTIONS_AND_DESK.md");
  assert(/Orchestrator|runTurn|5-layer|Capability/i.test(arch), "architecture updated");

  const open = read("docs/OPEN_SEQUENCE.md");
  assert(/O01|Orchestrator/i.test(open), "OPEN_SEQUENCE mentions O01");

  const plan = read("docs/features/ORCHESTRATOR_LAYER_PLAN.md");
  assert(/O5/.test(plan), "plan has O5");
  console.log("ok  O5 docs + CI wiring");
}

function main() {
  testNoDeprecatedWrapper();
  testSecurityGates();
  testObservability();
  testFixturesStillValid();
  testDocsAndScripts();
  console.log("\nAll O5 orchestrator checks passed.");
}

main();
