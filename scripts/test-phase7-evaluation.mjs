import assert from "node:assert/strict";
import {
  aggregateEvaluationMetrics,
  evaluateRolloutGate,
  isRolloutEnabled,
  ROLLOUT_STAGES,
} from "../lib/evaluation/rollout-gate.js";
import { routeSource } from "../lib/services/ai/source-policy.js";
import { buildKnowledgeEvidence, validateCapabilityResultBinding } from "../lib/services/ai/evidence-bundle.js";
import { canAdvanceProcedure, companyPackForBusiness } from "../lib/integrations/company-pack.js";
import { PHASE7_SEED_CASES, PHASE7_SEED_SUITE_VERSION } from "../lib/evaluation/seed-suite.js";

assert.equal(PHASE7_SEED_SUITE_VERSION, "phase7-seed-v1");
const cases = PHASE7_SEED_CASES.map((item) => ({
  ...item,
  ...(item.utterance ? { actualRoute: routeSource(item.utterance).route } : {}),
}));

const metrics = aggregateEvaluationMetrics(cases);
assert.equal(metrics.routeAccuracy, 1);
assert.equal(metrics.recoveryCorrectness, 1);
assert.equal(metrics.unauthorizedEffects, 0);
assert.equal(metrics.duplicateWrites, 0);
assert.equal(evaluateRolloutGate(metrics, ROLLOUT_STAGES.STAGING_SANDBOX).status, "ELIGIBLE_WITH_WARNINGS");

const unsafe = evaluateRolloutGate({ ...metrics, duplicateWrites: 1 }, ROLLOUT_STAGES.AUTHORIZED_COHORT);
assert.equal(unsafe.status, "BLOCKED");
assert(unsafe.failures.includes("DUPLICATE_WRITE"));
assert.equal(evaluateRolloutGate({ ...metrics, writeAttempts: 1 }, ROLLOUT_STAGES.SHADOW_READ_ONLY).status, "BLOCKED");

assert.equal(isRolloutEnabled({ capability: "order_status", companyPack: "ECOMMERCE" }), true);
assert.equal(isRolloutEnabled({ capability: "order_status", disabledCapabilities: ["order_status"] }), false);
assert.equal(isRolloutEnabled({ capability: "order_status", companyPack: "ECOMMERCE", disabledCompanyPacks: ["ECOMMERCE"] }), false);

const evidence = buildKnowledgeEvidence({ used: [{ id: "doc-1", name: "Return Policy" }], docs: [{ id: "doc-1" }], route: "STORE" });
assert.equal(evidence.state, "SUCCESS");
assert.equal(evidence.permissionScope, "AGENT_KNOWLEDGE");
assert.equal(validateCapabilityResultBinding({ action: { identityMode: "END_USER_TOKEN" }, customerSubject: "customer-1", bodyText: JSON.stringify({ customerId: "customer-2" }) }).errorCode, "RESULT_BINDING_MISMATCH");

const pack = companyPackForBusiness({ vertical: "E-commerce" });
assert.equal(pack.id, "ecommerce");
assert.equal(canAdvanceProcedure("confirm", "execute", { confirmed: false }).ok, false);
assert.equal(canAdvanceProcedure("confirm", "execute", { confirmed: true }).ok, true);

console.log("Phase 7 evaluation and rollout-gate tests passed");
console.log(JSON.stringify({ metrics, gate: evaluateRolloutGate(metrics, ROLLOUT_STAGES.STAGING_SANDBOX) }, null, 2));
