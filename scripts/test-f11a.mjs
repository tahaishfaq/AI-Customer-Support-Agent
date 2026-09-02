/**
 * F11 Phase A smoke — actions scope locked; schema + helpers + Customization tab.
 * Run: npm run test:f11a
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTION_HTTP_METHODS,
  ACTION_NAME_PATTERN,
  DEFAULT_ACTION_TIMEOUT_MS,
  MAX_TOOL_STEPS,
  TOOL_RUN_STATUS,
  canInvokeAgentAction,
  canManageAgentActions,
  clampActionTimeoutMs,
  isAllowedActionHttpMethod,
  isEnvSecretRef,
  isValidActionName,
  normalizeActionName,
  serializeActionForOwner,
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
  assert(
    /Phase A — Scope & identity ✅/.test(f11),
    "F11 Phase A should be marked done in plan"
  );
  assert(
    /Flow canvas/.test(f11) && /Direct DB/.test(f11),
    "F11-A must keep canvas and direct DB out of scope"
  );
  assert(
    /env:SHOP_API_KEY|Environment variable/.test(f11),
    "F11-A must document env secret strategy"
  );
  console.log("ok  F11-A doc scope");
}

function testSchemaContracts() {
  const schema = read("prisma/schema.prisma");
  assert(
    /enum ActionHttpMethod[\s\S]*GET[\s\S]*POST/.test(schema),
    "ActionHttpMethod enum"
  );
  assert(
    /enum ToolRunStatus[\s\S]*SSRF_BLOCKED[\s\S]*UNKNOWN_TOOL/.test(schema),
    "ToolRunStatus enum"
  );
  assert(
    /model AgentAction/.test(schema) &&
      schema.includes("urlTemplate") &&
      schema.includes("inputSchemaJson") &&
      schema.includes("timeoutMs"),
    "AgentAction model fields"
  );
  assert(
    /model ToolRun/.test(schema) && schema.includes("durationMs"),
    "ToolRun audit model"
  );
  assert(
    exists("prisma/migrations/20260824210000_f11_agent_actions/migration.sql"),
    "F11 migration must exist"
  );
  console.log("ok  prisma schema + migration");
}

function testActionHelpers() {
  assert(ACTION_HTTP_METHODS.includes("GET") && ACTION_HTTP_METHODS.includes("POST"));
  assert(MAX_TOOL_STEPS >= 3 && MAX_TOOL_STEPS <= 5, "max tool steps soft cap");
  assert(DEFAULT_ACTION_TIMEOUT_MS === 8000, "default timeout 8s");
  assert(TOOL_RUN_STATUS.SSRF_BLOCKED === "SSRF_BLOCKED");

  assert(canManageAgentActions({ userId: "u1", agent: { userId: "u1" } }));
  assert(!canManageAgentActions({ userId: "admin", agent: { userId: "u1" } }));

  assert(
    canInvokeAgentAction({ agentId: "a1", enabled: true }, "a1"),
    "enabled action ok"
  );
  assert(
    !canInvokeAgentAction({ agentId: "a1", enabled: false }, "a1"),
    "disabled blocked"
  );
  assert(
    !canInvokeAgentAction({ agentId: "a1", enabled: true }, "a2"),
    "cross-agent blocked"
  );

  assert(isAllowedActionHttpMethod("get") && isAllowedActionHttpMethod("POST"));
  assert(!isAllowedActionHttpMethod("DELETE"), "DELETE not in MVP");

  assert(normalizeActionName("Get Order") === "get_order");
  assert(isValidActionName("get_order_status"));
  assert(isValidActionName("Get Order"), "normalize then validate");
  assert(!isValidActionName("1bad"), "must start with letter");
  assert(!isValidActionName("x"), "too short");
  assert(ACTION_NAME_PATTERN.test("get_order_status"));

  assert(clampActionTimeoutMs(100) === 1000, "min clamp");
  assert(clampActionTimeoutMs(99999) === 15000, "max clamp");
  assert(isEnvSecretRef("env:SHOP_API_KEY"));
  assert(!isEnvSecretRef("sk-live-plain"), "raw keys not env refs");

  const serialized = serializeActionForOwner({
    id: "x",
    agentId: "a1",
    name: "get_order_status",
    description: "Lookup",
    method: "GET",
    urlTemplate: "https://api.example.com/orders/{{orderId}}",
    headersJson: { Authorization: "Bearer {{env:SHOP_API_KEY}}" },
    enabled: true,
    timeoutMs: 8000,
  });
  assert(serialized.name === "get_order_status");
  assert(
    String(JSON.stringify(serialized.headersJson)).includes("••••"),
    "owner serialize redacts env secret values"
  );
  assert(
    !String(JSON.stringify(serialized.headersJson)).includes("SHOP_API_KEY"),
    "owner serialize never shows env key name"
  );
  console.log("ok  action helper contracts");
}

function testCustomizationTab() {
  const studio = read("components/customization/CustomizationStudio.jsx");
  assert(/id: "actions"/.test(studio), "Actions section in Customization");
  assert(/ActionsForm/.test(studio), "ActionsForm wired");

  assert(exists("components/customization/ActionsForm.jsx"), "ActionsForm file");
  const form = read("components/customization/ActionsForm.jsx");
  const httpDialog = read("components/customization/HttpToolDialog.jsx");
  assert(
    /non-allowlisted hosts|Allowlisted/.test(form) ||
      /non-allowlisted hosts|Allowlisted/.test(httpDialog),
    "HTTP tool UI explains allowlist / SSRF"
  );
  // F11r UX: Connection tab stores encrypted credentials (preferred over env: refs in UI)
  assert(
    /env:SHOP_API_KEY|createAgentCredential|Paste API key|credentialId/.test(
      form
    ),
    "ActionsForm secrets via credentials (or legacy env refs)"
  );
  console.log("ok  Customization Actions tab");
}

function main() {
  testDocScope();
  testSchemaContracts();
  testActionHelpers();
  testCustomizationTab();
  console.log("\nF11-A smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11-A smoke FAILED:", error.message);
  process.exit(1);
}
