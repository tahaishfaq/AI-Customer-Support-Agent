import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { routeSource, filterCapabilitiesForSourceRoute } from "../lib/services/ai/source-policy.js";
import { ROUTING_A5_CASES, validateRoutingA5Catalog } from "../lib/evaluation/routing-fixtures.js";

const catalog = validateRoutingA5Catalog();
const results = [];
let assertions = 0;
const check = (value, message) => { assertions += 1; assert(value, message); };

function runCase(item) {
  const decision = routeSource(item.query);
  check(decision.route === item.expectedRoute, item.id + " route expected " + item.expectedRoute + " got " + decision.route);
  check(decision.mayInvokeWebSearch === item.expectedWeb, item.id + " web permission");

  if (item.category === "capability") {
    check(JSON.stringify(decision.entities) === JSON.stringify(item.expectedEntities), item.id + " entity classification");
    const filtered = filterCapabilitiesForSourceRoute(item.capabilities, decision);
    const names = filtered.map((capability) => capability.name);
    for (const expected of item.expectedCapabilities) check(names.includes(expected), item.id + " keeps " + expected);
    for (const forbidden of item.forbiddenCapabilities) check(!names.includes(forbidden), item.id + " strips " + forbidden);
  } else {
    check(decision.preferAgentKnowledge === (item.expectedRoute === "STORE" || item.expectedRoute === "MIXED"), item.id + " knowledge preference");
    check(decision.allowParametricKnowledge === (item.expectedRoute !== "STORE"), item.id + " parametric knowledge policy");
  }
  return { id: item.id, category: item.category, result: "PASS", evidenceStatus: "VERIFIED", route: decision.route };
}

for (const item of ROUTING_A5_CASES) {
  try {
    results.push(runCase(item));
  } catch (error) {
    results.push({ id: item.id, category: item.category, result: "FAIL", evidenceStatus: "VERIFIED", error: error.message });
  }
}

const failures = results.filter((item) => item.result !== "PASS");
const report = {
  gate: "A5",
  fixtureCatalog: { ...catalog, sanitized: true, liveProviders: false, staging: false },
  assertions,
  results,
  evidence: "local-contract",
  limitations: ["Does not prove live provider ranking, citations, or production traffic behavior."],
};
fs.mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), ".tmp", "aide-routing-a5-results.json"), JSON.stringify(report, null, 2) + "\n");
if (failures.length) {
  console.error("A5 routing matrix failed: " + failures.length + "/50");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("A5 routing matrix passed: " + results.length + "/50 cases, " + assertions + " assertions.");
console.log(JSON.stringify({ ...catalog, reportPath: ".tmp/aide-routing-a5-results.json", evidence: report.evidence }, null, 2));
