/**
 * F11 Phase C improvements — templates, redact, rate limit, kill switch.
 * Run: npm run test:f11d
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTION_TEMPLATES,
  SECRET_REDACT_PLACEHOLDER,
  mergeHeadersPreservingSecrets,
  redactHeadersJsonForUi,
  redactHeaderValueForUi,
} from "../lib/actions/action-config.js";
import { actionOutboundLimitOpts } from "../lib/rate-limit-config.js";

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
  assert(/Phase C — Improvements ✅/.test(f11), "F11 Phase C marked done");
  console.log("ok  F11-D doc scope");
}

function testSourceWiring() {
  assert(exists("prisma/migrations/20260824220000_f11_actions_kill_switch/migration.sql"));
  const schema = read("prisma/schema.prisma");
  assert(/actionsEnabled/.test(schema), "Agent.actionsEnabled in schema");

  const form = read("components/customization/ActionsForm.jsx");
  const httpDialog = read("components/customization/HttpToolDialog.jsx");
  assert(/ACTION_TEMPLATES/.test(form), "template library in UI");
  assert(/actionsEnabled|kill switch|Kill switch/i.test(form), "kill switch UI");
  assert(
    /SECRET_REDACT_PLACEHOLDER|••••/.test(form) ||
      /SECRET_REDACT_PLACEHOLDER|••••/.test(httpDialog),
    "redact hint in HTTP tool UI"
  );

  const loop = read("lib/actions/tool-loop.js");
  assert(/actionsEnabled/.test(loop), "kill switch in tool loop");
  assert(/RATE_LIMITED|actionOutboundLimitOpts/.test(loop), "outbound rate limit");

  const svc = read("lib/services/action.service.js");
  assert(/mergeHeadersPreservingSecrets/.test(svc), "preserve secrets on update");
  assert(/actionOutboundLimitOpts/.test(svc), "test path rate limit");

  console.log("ok  F11-D source wiring");
}

function testTemplatesAndRedact() {
  assert(ACTION_TEMPLATES.length >= 2, "at least GET + POST templates");
  assert(
    ACTION_TEMPLATES.some((t) => t.id === "get_json_by_id"),
    "GET JSON template"
  );
  assert(
    ACTION_TEMPLATES.some((t) => t.id === "post_webhook"),
    "POST webhook template"
  );

  const redacted = redactHeadersJsonForUi({
    Authorization: "Bearer {{env:SHOP_API_KEY}}",
    Accept: "application/json",
  });
  assert(
    redacted.Authorization.includes(SECRET_REDACT_PLACEHOLDER),
    "env ref redacted"
  );
  assert(redacted.Accept === "application/json", "safe header kept");

  assert(
    redactHeaderValueForUi("sk-live-supersecrettoken") === SECRET_REDACT_PLACEHOLDER,
    "opaque secret redacted"
  );

  const merged = mergeHeadersPreservingSecrets(
    { Authorization: `Bearer ${SECRET_REDACT_PLACEHOLDER}`, Accept: "application/json" },
    { Authorization: "Bearer {{env:SHOP_API_KEY}}", Accept: "text/plain" }
  );
  assert(
    merged.Authorization === "Bearer {{env:SHOP_API_KEY}}",
    "•••• preserves previous secret"
  );
  assert(merged.Accept === "application/json", "non-secret update applied");

  const opts = actionOutboundLimitOpts();
  assert(opts.limit >= 1 && opts.windowMs >= 1000, "outbound limit opts");

  console.log("ok  F11-D templates + redact + limits");
}

function main() {
  testDocScope();
  testSourceWiring();
  testTemplatesAndRedact();
  console.log("\nAll F11-D checks passed.");
}

main();
