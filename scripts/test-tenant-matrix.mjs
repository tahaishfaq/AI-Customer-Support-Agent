import assert from "node:assert/strict";
import { assertConversationAgentBinding, assertResourceSubjectBinding } from "../lib/actions/authz-binding.js";
import { isRolloutEnabled } from "../lib/evaluation/rollout-gate.js";
import { TENANT_FIXTURES } from "../lib/evaluation/tenant-fixtures.js";

assert.equal(TENANT_FIXTURES.length, 10);
assert.equal(new Set(TENANT_FIXTURES.map((x) => x.agentId)).size, 10);
assert.equal(new Set(TENANT_FIXTURES.map((x) => x.workspaceId)).size, 4);

let checks = 0;
for (const fixture of TENANT_FIXTURES) {
  assert.equal(assertConversationAgentBinding({ conversationAgentId: fixture.agentId, invokeAgentId: fixture.agentId, actionAgentId: fixture.agentId }).ok, true);
  checks += 1;

  const other = TENANT_FIXTURES.find((x) => x.agentId !== fixture.agentId);
  assert.equal(assertConversationAgentBinding({ conversationAgentId: other.agentId, invokeAgentId: fixture.agentId, actionAgentId: fixture.agentId }).code, "AUTHZ_CONVERSATION_MISMATCH");
  assert.equal(assertConversationAgentBinding({ conversationAgentId: fixture.agentId, invokeAgentId: fixture.agentId, actionAgentId: other.agentId }).code, "AUTHZ_AGENT_MISMATCH");
  checks += 2;

  assert.equal(assertResourceSubjectBinding({ toolArgs: { customerId: fixture.customerId }, customerSubject: fixture.customerId }).ok, true);
  assert.equal(assertResourceSubjectBinding({ toolArgs: { customerId: other.customerId }, customerSubject: fixture.customerId }).code, "CROSS_USER_DENIED");
  assert.equal(assertResourceSubjectBinding({ toolArgs: { userId: other.customerId }, customerSubject: null, publicAccess: true }).code, "CROSS_USER_DENIED");
  checks += 3;

  assert.equal(isRolloutEnabled({ capability: "read", companyPack: fixture.pack }), true);
  assert.equal(isRolloutEnabled({ capability: "read", companyPack: fixture.pack, disabledCompanyPacks: [fixture.pack] }), false);
  checks += 2;
}

for (const fixture of TENANT_FIXTURES) {
  for (const other of TENANT_FIXTURES) {
    if (fixture.agentId === other.agentId) continue;
    const sameWorkspace = fixture.workspaceId === other.workspaceId;
    const sameOwner = fixture.ownerId === other.ownerId;
    assert.notEqual(fixture.customerId, other.customerId);
    if (!sameWorkspace) assert.notEqual(fixture.workspaceId, other.workspaceId);
    if (!sameOwner) assert.notEqual(fixture.ownerId, other.ownerId);
    checks += 3;
  }
}

console.log(`Tenant matrix passed: ${TENANT_FIXTURES.length} agents, ${checks} contract assertions`);
console.log(JSON.stringify({
  agents: TENANT_FIXTURES.length,
  workspaces: new Set(TENANT_FIXTURES.map((x) => x.workspaceId)).size,
  owners: new Set(TENANT_FIXTURES.map((x) => x.ownerId)).size,
  sameWorkspacePairs: TENANT_FIXTURES.flatMap((a) => TENANT_FIXTURES.filter((b) => b.agentId !== a.agentId && b.workspaceId === a.workspaceId)).length / 2,
  crossWorkspacePairs: TENANT_FIXTURES.flatMap((a) => TENANT_FIXTURES.filter((b) => b.workspaceId !== a.workspaceId)).length / 2,
  note: "Pure contract matrix; database/public-token runtime proof remains separate.",
}, null, 2));
