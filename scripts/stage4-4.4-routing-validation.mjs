/**
 * Stage 4.4 — Store / Web / Knowledge routing regression. Read-only.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage4-4.4-routing-validation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const {
  classifySourceIntent,
  mayInvokeWebSearch,
  requiredSourceFamily,
  RESPONSE_RULES_STORE_FACTS,
} = await import("../lib/services/ai/source-policy.js");
const { buildResponseRules } = await import(
  "../lib/services/ai/prompt-builder.js"
);
const { listBuiltinActionsForAgent } = await import(
  "../lib/capabilities/builtins.js"
);

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "4.4", ...row });
}
function pass(id, input, evidence, actual = {}) {
  record({ id, category: "routing", input, status: "PASS", evidence, actual });
}
function fail(id, input, evidence, actual = {}) {
  record({ id, category: "routing", input, status: "FAIL", evidence, actual });
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const matrix = [
  ["Is Nike Air Max 90 in stock at my store?", "STORE_FACT", false, "STORE"],
  ["What is the price of Nike Air Max 90 in my store?", "STORE_FACT", false, "STORE"],
  ["What is my order status?", "STORE_FACT", false, "STORE"],
  ["What is REST?", "PUBLIC_KNOWLEDGE", false, "PUBLIC"],
  ["Search the internet for current events about AI", "WEB_REQUEST", true, "WEB"],
  ["Search online for today's news headlines", "WEB_REQUEST", true, "WEB"],
  ["Compare my store price with online prices", "MIXED", true, "MIXED"],
];

for (const [utterance, intent, mayWeb, family] of matrix) {
  const gotI = classifySourceIntent(utterance);
  const gotW = mayInvokeWebSearch(utterance);
  const gotF = requiredSourceFamily(utterance);
  const ok = gotI === intent && gotW === mayWeb && gotF === family;
  record({
    id: `S4.4-${family}-${utterance.slice(0, 28).replace(/\W+/g, "_")}`,
    category: "routing",
    input: utterance,
    status: ok ? "PASS" : "FAIL",
    evidence: "classifySourceIntent + mayInvokeWebSearch + requiredSourceFamily",
    expected: { intent, mayWeb, family },
    actual: { gotI, gotW, gotF },
  });
}

// Empty store → do not fabricate (prompt + PEP)
{
  const rules = buildResponseRules({ webSearchEnabled: true });
  const hasStore = /STORE FACTS/i.test(rules) && /cannot verify|not found/i.test(RESPONSE_RULES_STORE_FACTS);
  const pep = /STORE_SOURCE_REQUIRED/.test(
    read("lib/capabilities/adapters/builtin.adapter.js")
  );
  if (hasStore && pep) {
    pass(
      "S4.4-EMPTY-STORE",
      "Store empty + model knows product",
      "STORE FACTS + STORE_SOURCE_REQUIRED prevent web/parametric substitute for store facts"
    );
  } else {
    fail("S4.4-EMPTY-STORE", "empty store", "Missing hard store integrity controls", {
      hasStore,
      pep,
    });
  }
}

// Web tool only when flag on
{
  const on = listBuiltinActionsForAgent("a", { includeWebSearch: true }).some(
    (x) => x.name === "web_search"
  );
  const off = listBuiltinActionsForAgent("a", { includeWebSearch: false }).some(
    (x) => x.name === "web_search"
  );
  if (on && !off) {
    pass(
      "S4.4-WEB-FLAG",
      "webSearchEnabled",
      "web_search builtin only when includeWebSearch true"
    );
  } else {
    fail("S4.4-WEB-FLAG", "webSearchEnabled", "Flag wiring wrong", { on, off });
  }
}

// No auto web fallback in orchestrator
{
  const loop = read("lib/orchestrator/loop.js");
  if (!/fallbackToWeb|autoWebSearch/.test(loop)) {
    pass(
      "S4.4-NO-AUTO-WEB",
      "empty store results",
      "Orchestrator has no auto-fallback to web"
    );
  } else {
    fail("S4.4-NO-AUTO-WEB", "empty store results", "Auto web fallback present");
  }
}

fs.mkdirSync(outDir, { recursive: true });
const jsonlPath = path.join(outDir, "stage4-regression-results.jsonl");
const prior = fs.existsSync(jsonlPath)
  ? fs.readFileSync(jsonlPath, "utf8").split("\n").filter((l) => l && !l.includes('"phase":"4.4"'))
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
sec = [...sec.filter((r) => r.phase !== "4.4"), ...failures.map((f) => ({ ...f, phase: "4.4" }))];
fs.writeFileSync(secPath, JSON.stringify(sec, null, 2));

const verdict = failures.length === 0 ? "PASS" : "FAIL";
const report = `# Stage 4.4 — Store / Web / Knowledge Routing

Generated: ${new Date().toISOString()}

## Verdict: **${verdict}**

| PASS | FAIL | TOTAL |
| ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.length} |

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}${r.input ? ` — _${r.input}_` : ""}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${JSON.stringify(f.actual || f.evidence)}`).join("\n") : "- None"}

## Gate

- Next: **4.5 Prompt Injection Boundary**
`;
fs.writeFileSync(path.join(outDir, "stage4-4.4-routing.md"), report);
console.log(report);
process.exit(failures.length ? 1 : 0);
