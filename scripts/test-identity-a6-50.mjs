import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { assertConversationAgentBinding, assertResourceSubjectBinding } from "../lib/actions/authz-binding.js";
import { validateCapabilityResultBinding } from "../lib/services/ai/evidence-bundle.js";
import { TENANT_FIXTURES } from "../lib/evaluation/tenant-fixtures.js";
import { IDENTITY_A6_CASES, validateIdentityA6Catalog } from "../lib/evaluation/identity-fixtures.js";

const catalog = validateIdentityA6Catalog();
const results = [];
let assertions = 0;
const check = (value, message) => { assertions += 1; assert(value, message); };

function runCase(item, offset) {
  check(item.workspaceId !== undefined && item.agentId !== undefined, item.id + " has trusted tenant metadata");
  if (item.category === "own_subject") {
    check(assertResourceSubjectBinding({ toolArgs: { customerId: item.customerId }, customerSubject: item.customerId }).ok, item.id + " own customer allowed");
    check(assertResourceSubjectBinding({ toolArgs: { email: "visitor@example.test" }, customerSubject: "visitor@example.test" }).ok, item.id + " matching email allowed");
    check(assertConversationAgentBinding({ conversationAgentId: item.agentId, invokeAgentId: item.agentId, actionAgentId: item.agentId }).ok, item.id + " own agent allowed");
  } else if (item.category === "cross_user") {
    check(assertResourceSubjectBinding({ toolArgs: { customerId: item.otherCustomerId }, customerSubject: item.customerId }).code === "CROSS_USER_DENIED", item.id + " foreign customer denied");
    check(assertResourceSubjectBinding({ toolArgs: { userId: item.otherCustomerId }, customerSubject: item.customerId }).code === "CROSS_USER_DENIED", item.id + " foreign user denied");
    check(validateCapabilityResultBinding({ action: { identityMode: "END_USER_TOKEN" }, customerSubject: item.customerId, bodyText: JSON.stringify({ customerId: item.otherCustomerId }) }).errorCode === "RESULT_BINDING_MISMATCH", item.id + " foreign result denied");
  } else if (item.category === "claims") {
    check(assertResourceSubjectBinding({ toolArgs: { email: "other@example.test" }, customerSubject: "visitor@example.test", customerClaims: { email: "visitor@example.test" } }).code === "CROSS_USER_DENIED", item.id + " email claim mismatch denied");
    check(assertResourceSubjectBinding({ toolArgs: { phone: "9999999999" }, customerSubject: item.customerId, customerClaims: { phone: "1111111111" } }).code === "CROSS_USER_DENIED", item.id + " phone claim mismatch denied");
    check(assertResourceSubjectBinding({ toolArgs: { email: "visitor@example.test" }, customerSubject: "visitor@example.test", customerClaims: { email: "visitor@example.test" } }).ok, item.id + " matching claim allowed");
  } else if (item.category === "tenant_agent") {
    const otherIsDifferentWorkspace = item.workspaceId !== item.otherWorkspaceId;
    check(otherIsDifferentWorkspace || item.agentId !== item.otherAgentId, item.id + " has a distinct comparison tenant/agent");
    check(assertConversationAgentBinding({ conversationAgentId: item.agentId, invokeAgentId: item.agentId, actionAgentId: item.agentId }).ok, item.id + " same agent allowed");
    check(assertConversationAgentBinding({ conversationAgentId: item.otherAgentId, invokeAgentId: item.agentId, actionAgentId: item.agentId }).code === "AUTHZ_CONVERSATION_MISMATCH", item.id + " foreign conversation denied");
    check(assertConversationAgentBinding({ conversationAgentId: item.agentId, invokeAgentId: item.agentId, actionAgentId: item.otherAgentId }).code === "AUTHZ_AGENT_MISMATCH", item.id + " foreign action denied");
    check(assertConversationAgentBinding({ conversationAgentId: item.agentId, invokeAgentId: null, actionAgentId: item.agentId }).code === "AUTHZ_CONTEXT_INVALID", item.id + " missing trusted context denied");
  } else {
    check(assertResourceSubjectBinding({ toolArgs: { userId: item.otherCustomerId }, publicAccess: true }).code === "CROSS_USER_DENIED", item.id + " guest forged identity denied");
    check(assertResourceSubjectBinding({ toolArgs: { orderId: "synthetic-order-" + offset }, publicAccess: true }).ok, item.id + " public key is not private proof");
    check(assertResourceSubjectBinding({ toolArgs: { customerId: item.otherCustomerId }, customerSubject: item.customerId, publicAccess: true }).code === "CROSS_USER_DENIED", item.id + " public account switch denied");
    check(validateCapabilityResultBinding({ action: { identityMode: "END_USER_TOKEN" }, customerSubject: item.customerId, bodyText: JSON.stringify({ userId: item.otherCustomerId }) }).errorCode === "RESULT_BINDING_MISMATCH", item.id + " public result mismatch denied");
  }
  return { id: item.id, category: item.category, result: "PASS", evidenceStatus: "VERIFIED" };
}

check(TENANT_FIXTURES.length === 10, "10 synthetic agents");
check(new Set(TENANT_FIXTURES.map((item) => item.workspaceId)).size === 4, "4 synthetic workspaces");
check(new Set(TENANT_FIXTURES.map((item) => item.customerId)).size === 10, "unique synthetic customers");

for (const [offset, item] of IDENTITY_A6_CASES.entries()) {
  try {
    results.push(runCase(item, offset));
  } catch (error) {
    results.push({ id: item.id, category: item.category, result: "FAIL", evidenceStatus: "VERIFIED", error: error.message });
  }
}

const failures = results.filter((item) => item.result !== "PASS");
const report = {
  gate: "A6",
  fixtureCatalog: { ...catalog, sanitized: true, liveProviders: false, staging: false },
  assertions,
  results,
  evidence: "local-contract",
  limitations: ["Does not prove live session revocation, production database policy, or browser-origin enforcement."],
};
fs.mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), ".tmp", "aide-identity-a6-results.json"), JSON.stringify(report, null, 2) + "\n");
if (failures.length) {
  console.error("A6 identity matrix failed: " + failures.length + "/50");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("A6 identity matrix passed: " + results.length + "/50 cases, " + assertions + " assertions.");
console.log(JSON.stringify({ ...catalog, reportPath: ".tmp/aide-identity-a6-results.json", evidence: report.evidence }, null, 2));
