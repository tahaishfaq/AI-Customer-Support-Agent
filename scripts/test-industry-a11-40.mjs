import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { routeSource } from "../lib/services/ai/source-policy.js";
import { buildKnowledgeEvidence } from "../lib/services/ai/evidence-bundle.js";
import { selectKnowledgeChunks } from "../lib/services/ai/knowledge-retrieve.js";
import { INDUSTRY_A11_CASES, validateIndustryA11Catalog } from "../lib/evaluation/industry-fixtures.js";

const catalog = validateIndustryA11Catalog();
const results = [];
let assertions = 0;
const check = (value, message) => { assertions += 1; assert(value, message); };

function runCase(item) {
  const route = routeSource(item.query);
  check(route.mayInvokeWebSearch === false, item.id + " does not use web for business policy");
  const selected = selectKnowledgeChunks({ docs: item.docs, query: item.query });
  const evidence = buildKnowledgeEvidence({ used: selected.used, docs: item.docs, route: "STORE", crawlStatus: "DONE" });
  if (item.expected.state === "SUCCESS") {
    check(route.route === "STORE", item.id + " store policy route");
    check(selected.used.length === 1, item.id + " matching industry policy retrieved");
    check(evidence.state === "SUCCESS", item.id + " grounded policy evidence");
    check(evidence.binding.agentBound === true, item.id + " agent-bound evidence");
  } else {
    check(evidence.state === "UNAVAILABLE", item.id + " out-of-scope policy unavailable");
    check(selected.used.length === 0, item.id + " does not invent missing policy evidence");
    check(route.mayInvokeWebSearch === false, item.id + " regulated request does not web fallback");
  }
  check(item.workspaceId && item.agentId && item.customerId, item.id + " tenant metadata present");
  return { id: item.id, category: item.category, result: "PASS", evidenceStatus: "VERIFIED" };
}

for (const item of INDUSTRY_A11_CASES) {
  try {
    results.push(runCase(item));
  } catch (error) {
    results.push({ id: item.id, category: item.category, result: "FAIL", evidenceStatus: "VERIFIED", error: error.message });
  }
}

const failures = results.filter((item) => item.result !== "PASS");
const report = {
  gate: "A11",
  fixtureCatalog: { ...catalog, sanitized: true, liveProviders: false, staging: false },
  assertions,
  results,
  evidence: "local-contract",
  limitations: ["Does not prove human policy review, regulated-domain escalation quality, or live account authorization."],
};
fs.mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), ".tmp", "aide-industry-a11-results.json"), JSON.stringify(report, null, 2) + "\n");
if (failures.length) {
  console.error("A11 industry matrix failed: " + failures.length + "/40");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("A11 industry matrix passed: " + results.length + "/40 cases, " + assertions + " assertions.");
console.log(JSON.stringify({ ...catalog, reportPath: ".tmp/aide-industry-a11-results.json", evidence: report.evidence }, null, 2));
