import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, ".tmp");
const metrics = JSON.parse(fs.readFileSync(path.join(out, "stage6-6.3-metrics.json"), "utf8"));
const results = fs.readFileSync(path.join(out, "stage6-6.3-results.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
const failures = JSON.parse(fs.readFileSync(path.join(out, "stage6-6.3-failures.json"), "utf8"));

assert.equal(results.length, 14, "A15 should record all 14 performance checks");
assert.equal(failures.length, 0, "A15 has no performance failures");
assert.equal(results.filter((row) => row.status === "PASS").length, 11, "A15 pass count");
assert.equal(results.filter((row) => row.status === "INFO").length, 3, "A15 informational limitations");
assert.deepEqual(
  {
    MAX_TOOL_STEPS: metrics.caps.MAX_TOOL_STEPS,
    TOOL_LOOP_DEADLINE_MS: metrics.caps.TOOL_LOOP_DEADLINE_MS,
    MAX_CONCURRENT_OUTBOUND: metrics.caps.MAX_CONCURRENT_OUTBOUND,
    DEFAULT_ACTION_TIMEOUT_MS: metrics.caps.DEFAULT_ACTION_TIMEOUT_MS,
    maxToolResultChars: metrics.caps.maxToolResultChars,
    webSearchTimeoutMs: metrics.caps.webSearchTimeoutMs,
  },
  { MAX_TOOL_STEPS: 3, TOOL_LOOP_DEADLINE_MS: 25_000, MAX_CONCURRENT_OUTBOUND: 2, DEFAULT_ACTION_TIMEOUT_MS: 8000, maxToolResultChars: 4000, webSearchTimeoutMs: 12_000 },
  "frozen performance caps"
);
assert(metrics.hashArgs.p95 < 5, "hash p95");
assert(metrics.routeSource.p95 < 2, "route p95");
assert(metrics.fence.p95 < 10, "fence p95");
assert(metrics.dedupe.p95 < 2, "dedupe p95");
assert(metrics.filterCaps.p95 < 2, "filter p95");
if (metrics.dbPing) assert(metrics.dbPing.p95 < 2000, "database p95");

const report = {
  gate: "A15",
  status: "PASS",
  checks: results.length,
  pass: 11,
  info: 3,
  fail: 0,
  metrics,
  evidence: "local-microbench-and-local-db",
  limitations: ["Live LLM p50/p95, provider latency, browser delivery latency, and production concurrency were not measured."],
};
fs.writeFileSync(path.join(out, "aide-performance-a15-results.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`A15 performance gate passed: ${report.pass} PASS, ${report.info} INFO, ${report.fail} FAIL.`);
console.log(JSON.stringify({ gate: report.gate, status: report.status, dbP95Ms: metrics.dbPing?.p95 ?? null, reportPath: ".tmp/aide-performance-a15-results.json" }, null, 2));
