/**
 * F11 Phase G+H — infra confirmed + production checklist smoke.
 * Run: npm run test:f11h
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertActionUrlSafe } from "../lib/actions/ssrf.js";
import {
  MAX_TOOL_STEPS,
  canInvokeAgentAction,
} from "../lib/actions/action-config.js";

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
  assert(/Phase G — Infrastructure ✅/.test(f11), "Phase G done");
  assert(/Phase H — Production testing ✅/.test(f11), "Phase H done");
  assert(/\*\*Status:\*\*.*✅.*[Ss]hipped/s.test(f11) || /Status:.*✅ \*\*Shipped\*\*/.test(f11), "F11 shipped status");
  console.log("ok  F11-H doc scope");
}

function testInfraWiring() {
  assert(exists("prisma/migrations/20260824210000_f11_agent_actions/migration.sql"));
  assert(exists("app/api/demo/orders/[id]/route.js"), "demo orders route");
  assert(exists("lib/actions/ssrf.js"), "SSRF helper");
  assert(exists("lib/actions/http-executor.js"), "HTTP executor");
  assert(exists("lib/actions/tool-loop.js"), "chat tool loop");

  const schema = read("prisma/schema.prisma");
  assert(/model AgentAction/.test(schema) && /model ToolRun/.test(schema));

  const config = read("lib/actions/action-config.js");
  assert(/env:/.test(config) || /isEnvSecretRef/.test(config), "env secret refs");
  assert(/bcrypt/.test(config) === false || /bcrypt hash is banned/.test(config));

  console.log("ok  F11-H infra wiring");
}

function testChecklistBehaviors() {
  // SSRF blocked
  let ssrf = false;
  try {
    assertActionUrlSafe("https://169.254.169.254/latest/meta-data");
  } catch (err) {
    ssrf = err.code === "SSRF_BLOCKED";
  }
  assert(ssrf, "metadata SSRF blocked");

  // Max steps
  assert(MAX_TOOL_STEPS === 3, "max steps = 3");

  // Workspace isolation / disabled
  assert(
    !canInvokeAgentAction(
      { agentId: "a", enabled: true },
      "b"
    ),
    "cross-agent invoke denied"
  );
  assert(
    !canInvokeAgentAction({ agentId: "a", enabled: false }, "a"),
    "disabled not callable"
  );
  assert(
    canInvokeAgentAction({ agentId: "a", enabled: true }, "a"),
    "own enabled ok"
  );

  // Studio test + audit UI + embed same loop
  assert(exists("app/api/agents/[id]/actions/[actionId]/test/route.js"));
  assert(exists("app/api/agents/[id]/actions/runs/route.js"), "tool runs API");
  const form = read("components/customization/ActionsForm.jsx");
  assert(/listAgentToolRuns|Recent tool runs/.test(form), "owner audit UI");
  const chat = read("lib/services/chat.service.js");
  assert(/runTurn/.test(chat), "embed/studio share orchestrator runTurn");
  const bubble = read("components/chat/MessageBubble.jsx");
  assert(/toolSteps|Called:/.test(bubble), "studio tool timeline");

  const pkg = read("package.json");
  assert(/"test:f11"/.test(pkg), "test:f11 script");

  console.log("ok  F11-H checklist behaviors");
}

function testShippedDocs() {
  const shipped = read("docs/SHIPPED_FEATURES.md");
  assert(/F11/.test(shipped) && /[Aa]gent [Aa]ctions|[Aa]ctions/.test(shipped), "SHIPPED lists F11");
  console.log("ok  F11-H shipped docs");
}

function main() {
  testDocScope();
  testInfraWiring();
  testChecklistBehaviors();
  testShippedDocs();
  console.log("\nAll F11-H checks passed.");
}

main();
