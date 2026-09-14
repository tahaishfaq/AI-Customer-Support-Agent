/**
 * Stage 5.7 — Knowledge/RAG decision (skip unless Stage 4 proved bottleneck).
 * Stage 5.8 — Orchestrator waste reduction tests.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage5-5.7-5.8-orchestrator.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const { routeSource, filterCapabilitiesForSourceRoute } = await import(
  "../lib/services/ai/source-policy.js"
);
const {
  dedupeToolCalls,
  findPriorSuccessfulStep,
  shouldBreakBatchAfterStep,
  toolCallFingerprint,
  replayStepFromPrior,
} = await import("../lib/orchestrator/tool-waste.js");
const { needsUser, ok, escalate } = await import(
  "../lib/capabilities/result.js"
);

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: row.phase || "5.8", ...row });
}
function pass(id, evidence, actual = {}, phase = "5.8") {
  record({ id, phase, status: "PASS", evidence, actual });
}
function fail(id, evidence, actual = {}, phase = "5.8") {
  record({ id, phase, status: "FAIL", evidence, actual });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// --- 5.7 SKIP (N/A) ---
{
  const arch = read(".tmp/stage4-architecture-review.md");
  const reg = read(".tmp/stage4-regression-report.md");
  const onlyIf =
    /only if knowledge/i.test(arch) ||
    /only if Stage 5 proves bottleneck|only if.*bottleneck/i.test(reg);
  const noBottleneckClaim =
    !/knowledge.*(FAIL|CRITICAL|bottleneck proven)/i.test(arch) &&
    !/RAG.*(FAIL|CRITICAL)/i.test(arch);
  if (onlyIf && noBottleneckClaim) {
    pass(
      "S5.7-SKIP-N/A",
      "Stage 4 did not prove knowledge/RAG as a bottleneck — 5.7 skipped per plan",
      {},
      "5.7"
    );
  } else {
    fail(
      "S5.7-SKIP-N/A",
      "Could not confirm skip criteria from Stage 4 artifacts",
      { onlyIf, noBottleneckClaim },
      "5.7"
    );
  }
}

// Fingerprint stability
{
  const a = toolCallFingerprint("get_order", '{"id":"1","b":2}');
  const b = toolCallFingerprint("get_order", '{"b":2,"id":"1"}');
  const c = toolCallFingerprint("get_order", '{"id":"2"}');
  if (a === b && a !== c) {
    pass("S5.8-FINGERPRINT", "Args key-order independent fingerprint");
  } else {
    fail("S5.8-FINGERPRINT", "Fingerprint unstable", { a, b, c });
  }
}

// Dedupe batch
{
  const calls = [
    { id: "1", function: { name: "get_a", arguments: '{"x":1}' } },
    { id: "2", function: { name: "get_a", arguments: '{"x":1}' } },
    { id: "3", function: { name: "get_b", arguments: "{}" } },
  ];
  const out = dedupeToolCalls(calls);
  if (out.length === 2 && out[0].id === "1" && out[1].id === "3") {
    pass("S5.8-DEDUPE", "Duplicate tool_calls in one batch collapsed to first");
  } else {
    fail("S5.8-DEDUPE", "Dedupe failed", { out });
  }
}

// In-turn prior replay
{
  const prior = {
    name: "get_a",
    status: "OK",
    resultForModel: '{"ok":true}',
    _fingerprint: toolCallFingerprint("get_a", '{"x":1}'),
    _argsRaw: '{"x":1}',
  };
  const hit = findPriorSuccessfulStep([prior], "get_a", '{"x":1}');
  const miss = findPriorSuccessfulStep([prior], "get_a", '{"x":2}');
  const replay = replayStepFromPrior(prior, "get_a");
  if (hit && !miss && replay.idempotentReplay) {
    pass("S5.8-IN-TURN-REPLAY", "Prior successful same-args step reusable");
  } else {
    fail("S5.8-IN-TURN-REPLAY", "Prior replay broken", { hit, miss, replay });
  }
}

// Early batch break
{
  const confirmStep = {
    capabilityResult: needsUser({
      capabilityId: "create_ticket",
      forModel: "confirm",
      forClient: { type: "confirm" },
    }),
  };
  const okStep = {
    capabilityResult: ok({
      capabilityId: "get_a",
      forModel: "data",
    }),
  };
  const escStep = {
    capabilityResult: escalate({
      capabilityId: "handoff",
      forModel: "escalate",
    }),
  };
  if (
    shouldBreakBatchAfterStep(confirmStep) &&
    shouldBreakBatchAfterStep(escStep) &&
    !shouldBreakBatchAfterStep(okStep)
  ) {
    pass(
      "S5.8-EARLY-STOP",
      "needs_user/escalate break remaining batch tools; OK does not"
    );
  } else {
    fail("S5.8-EARLY-STOP", "Break rules wrong");
  }
}

// GENERAL/WEB strip WRITE
{
  const caps = [
    { name: "get_order", riskLevel: "READ" },
    { name: "create_ticket", riskLevel: "WRITE" },
    { name: "web_search", riskLevel: "READ" },
  ];
  const general = filterCapabilitiesForSourceRoute(
    caps,
    routeSource("What is REST?")
  );
  const web = filterCapabilitiesForSourceRoute(
    caps,
    routeSource("Search the internet for AI news")
  );
  const store = filterCapabilitiesForSourceRoute(
    caps,
    routeSource("What is my order status?")
  );
  const gNames = general.map((c) => c.name);
  const wNames = web.map((c) => c.name);
  const sNames = store.map((c) => c.name);
  if (
    !gNames.includes("create_ticket") &&
    !gNames.includes("web_search") &&
    gNames.includes("get_order") &&
    !wNames.includes("create_ticket") &&
    wNames.includes("web_search") &&
    sNames.includes("create_ticket") &&
    !sNames.includes("web_search")
  ) {
    pass(
      "S5.8-STRIP-WRITES",
      "GENERAL/WEB strip WRITE; STORE keeps WRITE; web_search route-gated"
    );
  } else {
    fail("S5.8-STRIP-WRITES", "Route tool filter wrong", {
      gNames,
      wNames,
      sNames,
    });
  }
}

// Loop wiring
{
  const loop = read("lib/orchestrator/loop.js");
  if (
    /dedupeToolCalls/.test(loop) &&
    /findPriorSuccessfulStep/.test(loop) &&
    /shouldBreakBatchAfterStep/.test(loop)
  ) {
    pass("S5.8-WIRED", "Orchestrator loop uses waste helpers");
  } else {
    fail("S5.8-WIRED", "Loop not wired");
  }
}

fs.mkdirSync(outDir, { recursive: true });

// 5.7 report
const r57 = results.filter((r) => r.phase === "5.7");
const f57 = r57.filter((r) => r.status === "FAIL");
const report57 = `# Stage 5.7 — Knowledge / RAG

Generated: ${new Date().toISOString()}

## Verdict: **${f57.length ? "FAIL" : "SKIP (N/A)"}**

Stage 4 explicitly scoped 5.7 as **only if** knowledge quality is a proven bottleneck.
Architecture review graded source/knowledge routing PASS at P0 and did **not** name RAG as a critical gap.

**Decision:** Skip RAG rewrite. No product code changes for 5.7.

## Results

${r57.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Gate

- Proceed to **5.8 Orchestrator waste reduction**
`;
fs.writeFileSync(path.join(outDir, "stage5-5.7-report.md"), report57);

// 5.8 report
const r58 = results.filter((r) => r.phase === "5.8");
const f58 = r58.filter((r) => r.status === "FAIL");
const report58 = `# Stage 5.8 — Orchestrator Waste Reduction

Generated: ${new Date().toISOString()}

## Verdict: **${f58.length ? "FAIL" : "PASS"}**

| PASS | FAIL | TOTAL |
| ---: | ---: | ---: |
| ${r58.filter((r) => r.status === "PASS").length} | ${f58.length} | ${r58.length} |

## Hardening

1. **Dedupe** identical \`tool_calls\` in one LLM batch
2. **In-turn replay** of prior successful same name+args (no second invoke)
3. **Early batch stop** after \`needs_user\` / \`escalate\`
4. **Route filter** — GENERAL/WEB strip WRITE/DESTRUCTIVE tools (temptation reduction)

## Results

${r58.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${f58.length ? f58.map((f) => `- ${f.id}: ${JSON.stringify(f.actual || f.evidence)}`).join("\n") : "- None"}

## Gate

- Stage 5 checklist complete → **Stage 6** on request
`;

fs.writeFileSync(path.join(outDir, "stage5-5.8-report.md"), report58);
fs.writeFileSync(
  path.join(outDir, "stage5-5.8-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage5-5.8-failures.json"),
  JSON.stringify([...f57, ...f58], null, 2)
);

console.log(report57);
console.log("\n---\n");
console.log(report58);
process.exit(f57.length || f58.length ? 1 : 0);
