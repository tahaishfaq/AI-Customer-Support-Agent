/**
 * Stage 6.6 — Architecture freeze verification.
 * Confirms frozen trust-path modules/caps still match Stage 6 freeze doc.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage6-6.6-architecture-freeze.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const {
  MAX_TOOL_STEPS,
  TOOL_LOOP_DEADLINE_MS,
  MAX_CONCURRENT_OUTBOUND,
  DEFAULT_ACTION_TIMEOUT_MS,
} = await import("../lib/actions/action-config.js");
const { SOURCE_ROUTES, routeSource } = await import(
  "../lib/services/ai/source-policy.js"
);
const { CONFIRMATION_LIFECYCLE, statusToLifecyclePhase } = await import(
  "../lib/services/confirmation.service.js"
);
const { CAPABILITY_STATUSES } = await import("../lib/capabilities/result.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "6.6", ...row });
}
function pass(id, evidence, actual = {}) {
  record({ id, status: "PASS", evidence, actual });
}
function fail(id, evidence, actual = {}) {
  record({ id, status: "FAIL", evidence, actual });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// Freeze doc present
{
  if (exists("docs/ARCHITECTURE_FREEZE_STAGE6.md")) {
    const doc = read("docs/ARCHITECTURE_FREEZE_STAGE6.md");
    if (
      /FROZEN/.test(doc) &&
      /SOURCE ROUTER/.test(doc) &&
      /DATA ≠ AUTHORITY|DATA != AUTHORITY/.test(doc)
    ) {
      pass("S6.6-DOC", "Architecture freeze doc present with trust path + invariant");
    } else {
      fail("S6.6-DOC", "Freeze doc incomplete");
    }
  } else {
    fail("S6.6-DOC", "docs/ARCHITECTURE_FREEZE_STAGE6.md missing");
  }
}

// Canonical modules exist
{
  const mods = [
    "lib/orchestrator/index.js",
    "lib/orchestrator/loop.js",
    "lib/orchestrator/tool-waste.js",
    "lib/orchestrator/stop-rules.js",
    "lib/actions/invoke-tool.js",
    "lib/actions/policy.js",
    "lib/actions/authz-binding.js",
    "lib/actions/untrusted-result.js",
    "lib/actions/write-idempotency.js",
    "lib/actions/ssrf.js",
    "lib/services/ai/web-search-config.js",
    "lib/services/ai/web-search-result.js",
    "lib/services/confirmation.service.js",
    "lib/services/ai/source-policy.js",
    "lib/services/chat.service.js",
    "lib/services/ai/knowledge-retrieve.js",
    "lib/capabilities/result.js",
  ];
  const missing = mods.filter((m) => !exists(m));
  if (!missing.length) {
    pass("S6.6-MODULES", `All ${mods.length} frozen canonical modules present`);
  } else {
    fail("S6.6-MODULES", "Missing modules", { missing });
  }
}

// Caps
{
  const caps = {
    MAX_TOOL_STEPS,
    TOOL_LOOP_DEADLINE_MS,
    MAX_CONCURRENT_OUTBOUND,
    DEFAULT_ACTION_TIMEOUT_MS,
  };
  if (
    MAX_TOOL_STEPS === 3 &&
    TOOL_LOOP_DEADLINE_MS === 25_000 &&
    MAX_CONCURRENT_OUTBOUND === 2 &&
    DEFAULT_ACTION_TIMEOUT_MS === 8000
  ) {
    pass("S6.6-CAPS", "Frozen operational caps unchanged", caps);
  } else {
    fail("S6.6-CAPS", "Cap drift vs freeze", caps);
  }
}

// Trust path wiring
{
  const loop = read("lib/orchestrator/loop.js");
  const invoke = read("lib/actions/invoke-tool.js");
  const chat = read("lib/services/chat.service.js");
  const index = read("lib/orchestrator/index.js");
  const wired =
    /runTurn/.test(index) &&
    /invokeOneTool/.test(loop) &&
    /routeSource|filterCapabilitiesForSourceRoute/.test(loop) &&
    /fenceUntrustedText/.test(loop) &&
    /evaluateActionPolicy/.test(invoke) &&
    /claimApprovedConfirmation/.test(invoke) &&
    /beginWriteIdempotency|buildWriteIdempotencyKey/.test(invoke) &&
    /applySourceRouteToSystem|routeSource/.test(chat);
  if (wired) {
    pass(
      "S6.6-WIRED",
      "Authz/router/PEP/confirm/idempotency/fence still on orchestrator+chat path"
    );
  } else {
    fail("S6.6-WIRED", "Trust path wiring broken");
  }
}

// DATA ≠ AUTHORITY
{
  const invoke = read("lib/actions/invoke-tool.js");
  const untrusted = read("lib/actions/untrusted-result.js");
  const noBodyAuthority =
    !/confirmationStatus\s*=\s*.*JSON\.parse/.test(invoke) &&
    /UNTRUSTED EXTERNAL DATA/.test(untrusted) &&
    /fenceUntrustedText/.test(untrusted);
  if (noBodyAuthority) {
    pass("S6.6-DATA-NE-AUTHORITY", "Tool bodies cannot set confirmation; fence required");
  } else {
    fail("S6.6-DATA-NE-AUTHORITY", "Authority leak risk in invoke/untrusted");
  }
}

// Source routes + confirmation lifecycle
{
  const routes = Object.values(SOURCE_ROUTES).sort().join(",");
  const phase = statusToLifecyclePhase("APPROVED");
  if (
    routes === "GENERAL,MIXED,STORE,WEB" &&
    phase === "CONFIRMED" &&
    CONFIRMATION_LIFECYCLE.CONSUMED === "CONSUMED"
  ) {
    pass(
      "S6.6-ROUTES-LIFECYCLE",
      "SOURCE_ROUTES STORE/WEB/GENERAL/MIXED; APPROVED→CONFIRMED lifecycle"
    );
  } else {
    fail("S6.6-ROUTES-LIFECYCLE", "Route/lifecycle drift", { routes, phase });
  }
}

// Capability statuses frozen
{
  const want = ["ok", "denied", "needs_user", "error", "escalate"].join(",");
  const got = [...CAPABILITY_STATUSES].sort().join(",");
  // order in const may differ
  const setOk =
    CAPABILITY_STATUSES.includes("ok") &&
    CAPABILITY_STATUSES.includes("denied") &&
    CAPABILITY_STATUSES.includes("needs_user") &&
    CAPABILITY_STATUSES.includes("error") &&
    CAPABILITY_STATUSES.includes("escalate") &&
    CAPABILITY_STATUSES.length === 5;
  if (setOk) {
    pass("S6.6-CAPABILITY-STATUS", "CapabilityResult statuses frozen (5)");
  } else {
    fail("S6.6-CAPABILITY-STATUS", "Status set drifted", { got, want });
  }
}

// No auto web fallback
{
  const loop = read("lib/orchestrator/loop.js");
  if (!/fallbackToWeb|autoWebSearch/.test(loop)) {
    pass("S6.6-NO-AUTO-WEB", "No empty-store → web auto-fallback in orchestrator");
  } else {
    fail("S6.6-NO-AUTO-WEB", "Auto web fallback present");
  }
}

// Smoke: store ask still STORE
{
  const d = routeSource("Is the blue hoodie in stock at my store?");
  if (d.route === "STORE" && !d.mayInvokeWebSearch) {
    pass("S6.6-SMOKE-STORE", "Store ask still routes STORE without web");
  } else {
    fail("S6.6-SMOKE-STORE", "Store routing drifted", d);
  }
}

// Prior Stage 6 reports exist
{
  const prior = [
    ".tmp/stage6-6.1-report.md",
    ".tmp/stage6-6.2-adversarial-report.md",
    ".tmp/stage6-6.3-perf-report.md",
    ".tmp/stage6-6.4-abuse-report.md",
    ".tmp/stage6-6.5-reliability-report.md",
  ];
  const missing = prior.filter((p) => !exists(p));
  if (!missing.length) {
    pass("S6.6-PRIOR-PASS", "Stages 6.1–6.5 reports present as freeze prerequisite");
  } else {
    fail("S6.6-PRIOR-PASS", "Missing prior Stage 6 reports", { missing });
  }
}

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 6.6 — Architecture Freeze

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "FROZEN (PASS)"}**

| PASS | FAIL | TOTAL |
| ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.length} |

## Frozen path

\`\`\`text
USER → AUTH → TRUSTED CONTEXT → ORCHESTRATOR
  → SOURCE ROUTER → POLICY PEP → TOOL GATEWAY
       → Knowledge | HTTP | MCP | Builtins
  → RESULT FENCE → ORCHESTRATOR → ANSWER
\`\`\`

Canonical doc: \`docs/ARCHITECTURE_FREEZE_STAGE6.md\`

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Change control

After this freeze: no drive-by architecture rewrites. CRITICAL security fixes OK with freeze amend. RAG 5.7 remains deferred.

## Gate

- Next on request: **6.7 Production readiness sign-off**
`;

fs.writeFileSync(path.join(outDir, "stage6-6.6-architecture-freeze.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage6-6.6-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage6-6.6-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
