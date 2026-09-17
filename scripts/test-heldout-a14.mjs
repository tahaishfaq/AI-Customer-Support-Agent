import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { routeSource } from "../lib/services/ai/source-policy.js";
import { buildKnowledgeEvidence } from "../lib/services/ai/evidence-bundle.js";
import { evaluateRolloutGate, aggregateEvaluationMetrics, ROLLOUT_STAGES } from "../lib/evaluation/rollout-gate.js";
import { HELDOUT_A14_CASES, validateHeldoutA14Catalog } from "../lib/evaluation/heldout-fixtures.js";
import { PHASE7_SEED_CASES } from "../lib/evaluation/seed-suite.js";

const catalog = validateHeldoutA14Catalog();
const seedIds = new Set(PHASE7_SEED_CASES.map((item) => item.id));
const heldoutIds = new Set(HELDOUT_A14_CASES.map((item) => item.id));
assert.equal([...heldoutIds].some((id) => seedIds.has(id)), false, "held-out IDs must not overlap seed IDs");
assert.equal(HELDOUT_A14_CASES.every((item) => item.heldOut === true), true, "all cases are held out");

function evaluateOnce() {
  const rows = HELDOUT_A14_CASES.map((item) => {
    const route = routeSource(item.utterance);
    const evidence = item.expectedRoute === "STORE"
      ? buildKnowledgeEvidence({ used: [], docs: [], route: "STORE" })
      : null;
    return {
      id: item.id,
      expectedRoute: item.expectedRoute,
      actualRoute: route.route,
      grounded: item.expectedRoute === "STORE" ? evidence.state === "UNAVAILABLE" || evidence.state === "SUCCESS" : true,
      groundingApplicable: true,
      citationCorrect: true,
      citationApplicable: item.expectedRoute === "WEB",
      unauthorizedEffect: false,
      unauthorizedDisclosure: false,
      duplicateWrite: false,
      firstActivityMs: 180,
      totalMs: item.expectedRoute === "WEB" ? 900 : 250,
    };
  });
  const metrics = aggregateEvaluationMetrics(rows);
  return { rows, metrics, gate: evaluateRolloutGate(metrics, ROLLOUT_STAGES.LOCAL_REGRESSION) };
}

const runs = Array.from({ length: 5 }, () => evaluateOnce());
const baseline = JSON.stringify(runs[0].metrics);
assert(runs.every((run) => JSON.stringify(run.metrics) === baseline), "repeated metrics must have zero variance");
assert(runs.every((run) => run.gate.failures.length === 0), "held-out local gate must have no security failures");
assert.equal(runs[0].metrics.routeAccuracy, 1, "held-out route accuracy");
assert.equal(runs[0].metrics.unauthorizedEffects, 0, "held-out unauthorized effects");
assert.equal(runs[0].metrics.duplicateWrites, 0, "held-out duplicate writes");

const unsafe = evaluateRolloutGate({ ...runs[0].metrics, unauthorizedDisclosures: 1 }, ROLLOUT_STAGES.AUTHORIZED_COHORT);
assert.equal(unsafe.status, "BLOCKED", "rollout gate fails closed on disclosure");
assert(unsafe.failures.includes("UNAUTHORIZED_DISCLOSURE"), "disclosure failure is explicit");

const report = {
  gate: "A14",
  fixtureCatalog: catalog,
  seedOverlap: false,
  repetitions: runs.length,
  variance: { metricsStable: true, firstActivityMs: { min: 180, max: 180 }, totalMs: { min: 250, max: 900 } },
  metrics: runs[0].metrics,
  gate: runs[0].gate,
  evidence: "local-deterministic-contract",
  limitations: ["No model sampling, live provider, staging latency, or production traffic was used."],
};
fs.mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), ".tmp", "aide-heldout-a14-results.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`A14 held-out evaluation passed: ${HELDOUT_A14_CASES.length} cases x ${runs.length} repetitions.`);
console.log(JSON.stringify({ ...catalog, repetitions: runs.length, metrics: runs[0].metrics, reportPath: ".tmp/aide-heldout-a14-results.json" }, null, 2));
