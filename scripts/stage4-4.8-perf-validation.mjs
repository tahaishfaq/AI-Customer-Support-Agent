/**
 * Stage 4.8 — Performance / abuse (light architectural scan). Read-only.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage4-4.8-perf-validation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const {
  MAX_TOOL_STEPS,
  TOOL_LOOP_DEADLINE_MS,
} = await import("../lib/actions/action-config.js");
const { actionOutboundLimitOpts } = await import(
  "../lib/rate-limit-config.js"
);
const { hashArgs } = await import("../lib/actions/identity.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "4.8", ...row });
}
function pass(id, input, evidence, actual = {}) {
  record({ id, category: "performance", input, status: "PASS", evidence, actual });
}
function fail(id, input, evidence, actual = {}) {
  record({ id, category: "performance", input, status: "FAIL", evidence, actual });
}
function note(id, input, evidence, severity = "P2") {
  record({
    id,
    category: "performance",
    input,
    status: "INFO",
    evidence,
    severity,
  });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// Caps that bound cost/abuse
{
  const outbound = actionOutboundLimitOpts();
  const loop = read("lib/orchestrator/loop.js");
  const trunc = /MAX_TOOL_RESULT_CHARS\s*=\s*(\d+)/.exec(loop);
  const maxResult = trunc ? Number(trunc[1]) : null;
  if (
    MAX_TOOL_STEPS === 3 &&
    TOOL_LOOP_DEADLINE_MS === 25000 &&
    outbound &&
    maxResult
  ) {
    pass(
      "S4.8-COST-CAPS",
      "1/10/100 request shape",
      "Per-turn caps: 3 tools, 25s deadline, outbound rate limit, tool result truncate",
      { outbound, maxResult }
    );
  } else {
    fail("S4.8-COST-CAPS", "caps", "Missing cost caps", {
      outbound,
      maxResult,
    });
  }
}

// Knowledge size caps
{
  const envEx = read(".env.example");
  const know = read("lib/services/ai/knowledge-retrieve.js");
  if (
    /KNOWLEDGE_MAX_CHARS|KNOWLEDGE_MAX_CHUNKS/.test(envEx) ||
    /MAX_CHARS|maxChunks|12000/.test(know)
  ) {
    pass(
      "S4.8-KNOWLEDGE-CAP",
      "context growth",
      "Knowledge stuffing has char/chunk caps"
    );
  } else {
    fail("S4.8-KNOWLEDGE-CAP", "context growth", "No knowledge caps found");
  }
}

// Confirmation dedupe of PENDING
{
  const conf = read("lib/services/confirmation.service.js");
  if (/status: "PENDING"/.test(conf) && /existing/.test(conf)) {
    pass(
      "S4.8-CONFIRM-DEDUP",
      "repeated confirmation creation",
      "createPendingConfirmation reuses existing PENDING for same argsHash"
    );
  } else {
    fail(
      "S4.8-CONFIRM-DEDUP",
      "repeated confirmation creation",
      "No PENDING reuse evidence"
    );
  }
}

// Micro-bench: hashArgs throughput (local CPU only)
{
  const n = 1000;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) hashArgs({ i, q: "x".repeat(20) });
  const ms = Date.now() - t0;
  if (ms < 2000) {
    pass(
      "S4.8-HASH-BENCH",
      `${n} hashArgs`,
      `Completed in ${ms}ms (local microbench; not load test)`
    );
  } else {
    fail("S4.8-HASH-BENCH", `${n} hashArgs`, `Slow: ${ms}ms`);
  }
}

// Bottleneck notes (not fails)
note(
  "S4.8-NOTE-LLM",
  "orchestrator latency",
  "Dominant cost is OpenAI turns (up to 3 tool rounds + final). Stage 6 should measure live p95.",
  "P2"
);
note(
  "S4.8-NOTE-WEB",
  "WebSearch",
  "Each web_search is external HTTP (~12s timeout). Abuse limited by max steps + rate limit + intent PEP.",
  "P2"
);
note(
  "S4.8-NOTE-100",
  "100 concurrent chats",
  "Not executed here (Stage 6). Watch PG pool (PG_POOL_MAX) + outbound semaphore under concurrency.",
  "P2"
);

fs.mkdirSync(outDir, { recursive: true });
const jsonlPath = path.join(outDir, "stage4-regression-results.jsonl");
const prior = fs.existsSync(jsonlPath)
  ? fs.readFileSync(jsonlPath, "utf8").split("\n").filter((l) => l && !l.includes('"phase":"4.8"'))
  : [];
fs.writeFileSync(jsonlPath, [...prior, ...results.map((r) => JSON.stringify(r))].join("\n") + "\n");
const failures = results.filter((r) => r.status === "FAIL");
const secPath = path.join(outDir, "stage4-security-failures.json");
let sec = [];
try {
  sec = JSON.parse(fs.readFileSync(secPath, "utf8"));
  if (!Array.isArray(sec)) sec = [];
} catch {
  sec = [];
}
sec = [...sec.filter((r) => r.phase !== "4.8"), ...failures.map((f) => ({ ...f, phase: "4.8" }))];
fs.writeFileSync(secPath, JSON.stringify(sec, null, 2));

const verdict = failures.length === 0 ? "PASS" : "FAIL";
const report = `# Stage 4.8 — Performance / Abuse (light)

Generated: ${new Date().toISOString()}

## Verdict: **${verdict}**

Not a full load test (Stage 6). Architectural bottleneck scan only.

| PASS | FAIL | INFO | TOTAL |
| ---: | ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.filter((r) => r.status === "INFO").length} | ${results.length} |

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Bottlenecks noted for Stage 5/6

- LLM multi-turn dominates latency/cost
- WebSearch external calls under 3-step budget
- Neon pool + outbound semaphore under concurrency

## Gate

- Next: **4.9 Architecture Review + final verdict**
`;
fs.writeFileSync(path.join(outDir, "stage4-4.8-perf.md"), report);
console.log(report);
process.exit(failures.length ? 1 : 0);
