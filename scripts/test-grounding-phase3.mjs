import assert from "node:assert/strict";
import {
  buildCapabilityEvidence,
  buildKnowledgeEvidence,
  validateCapabilityResultBinding,
  EVIDENCE_STATES,
} from "../lib/services/ai/evidence-bundle.js";

const docs = [
  {
    id: "returns",
    name: "Returns FAQ",
    type: "TEXT",
    updatedAt: "2026-09-15T10:00:00.000Z",
  },
];

const success = buildKnowledgeEvidence({
  used: [{ id: "returns", name: "Returns FAQ", type: "TEXT" }],
  docs,
  route: "STORE",
  retrievedAt: "2026-09-15T11:00:00.000Z",
  crawlStatus: "DONE",
});
assert.equal(success.state, EVIDENCE_STATES.SUCCESS);
assert.equal(success.permissionScope, "AGENT_KNOWLEDGE");
assert.equal(success.binding.agentBound, true);
assert.equal(success.sources[0].sourceId, "returns");
assert.equal(success.sources[0].sourceTime, "2026-09-15T10:00:00.000Z");

assert.equal(
  buildKnowledgeEvidence({ used: [], docs, crawlStatus: "DONE" }).state,
  EVIDENCE_STATES.EMPTY
);
assert.equal(
  buildKnowledgeEvidence({ used: [{ id: "returns" }], docs, crawlStatus: "PARTIAL" }).state,
  EVIDENCE_STATES.PARTIAL
);
assert.equal(
  buildKnowledgeEvidence({ used: [], docs: [] }).state,
  EVIDENCE_STATES.UNAVAILABLE
);

const toolEvidence = buildCapabilityEvidence({
  action: {
    id: "action-1",
    agentId: "agent-1",
    accessClass: "END_USER",
    identityMode: "END_USER_TOKEN",
    version: 3,
    responseProjectionJson: { fields: ["status", "eta"] },
  },
  step: { status: "OK", httpStatus: 200 },
  agentId: "agent-1",
  conversationId: "conversation-1",
  route: "STORE",
});
assert.equal(toolEvidence.state, EVIDENCE_STATES.SUCCESS);
assert.equal(toolEvidence.sourceId, "action-1");
assert.equal(toolEvidence.binding.agentBound, true);
assert.equal(toolEvidence.binding.customerBound, true);
assert.deepEqual(toolEvidence.response.fields, ["status", "eta"]);

assert.equal(
  validateCapabilityResultBinding({
    bodyText: JSON.stringify({ order: { customerId: "customer-B", status: "shipped" } }),
    action: { identityMode: "END_USER_TOKEN" },
    customerSubject: "customer-A",
  }).errorCode,
  "RESULT_BINDING_MISMATCH"
);
assert.equal(
  validateCapabilityResultBinding({
    bodyText: JSON.stringify({ order: { customerId: "customer-A", status: "shipped" } }),
    action: { identityMode: "END_USER_TOKEN" },
    customerSubject: "customer-A",
  }).ok,
  true
);

console.log("PASS Phase 3 grounding evidence: source, scope, binding, freshness, and empty states");
