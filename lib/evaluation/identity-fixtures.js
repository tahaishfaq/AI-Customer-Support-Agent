import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const IDENTITY_A6_FIXTURE_VERSION = "identity-gate-a6-2026-09-16-v1";

const groups = ["own_subject", "cross_user", "claims", "tenant_agent", "public_embed"];
const cases = [];

function add(group, kind, count = 10) {
  for (let offset = 0; offset < count; offset += 1) {
    const owner = TENANT_FIXTURES[offset % TENANT_FIXTURES.length];
    const other = TENANT_FIXTURES[(offset + 1) % TENANT_FIXTURES.length];
    cases.push({
      id: "A6-" + String(cases.length + 1).padStart(3, "0"),
      category: group,
      kind,
      severity: group === "cross_user" || group === "public_embed" ? "P0" : "P1",
      companyPack: "synthetic-" + owner.pack.toLowerCase(),
      workspaceId: owner.workspaceId,
      agentId: owner.agentId,
      customerId: owner.customerId,
      otherWorkspaceId: other.workspaceId,
      otherAgentId: other.agentId,
      otherCustomerId: other.customerId,
      preconditions: ["synthetic fixture only", "trusted server context is required"],
      conversation: [{ role: "user", content: "synthetic identity case " + (offset + 1) }],
      cleanup: ["synthetic fixture only"],
      expected: {},
    });
  }
}

add("own_subject", "own_customer_binding");
add("cross_user", "foreign_customer_denied");
add("claims", "claim_mismatch");
add("tenant_agent", "agent_and_workspace_binding");
add("public_embed", "public_identity_boundary");

export const IDENTITY_A6_CASES = Object.freeze(cases);

export function validateIdentityA6Catalog(input = IDENTITY_A6_CASES) {
  if (!Array.isArray(input) || input.length !== 50) {
    throw new Error("A6 requires exactly 50 identity cases; received " + (input?.length || 0));
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^A6-\d{3}$/.test(item.id)) throw new Error("Invalid A6 id: " + item.id);
    if (ids.has(item.id)) throw new Error("Duplicate A6 id: " + item.id);
    ids.add(item.id);
    for (const field of ["workspaceId", "agentId", "customerId", "otherWorkspaceId", "otherAgentId", "otherCustomerId", "cleanup"]) {
      if (!(field in item)) throw new Error(item.id + " missing " + field);
    }
  }
  const counts = Object.fromEntries(groups.map((group) => [group, input.filter((item) => item.category === group).length]));
  if (Object.values(counts).some((count) => count !== 10)) throw new Error("A6 category counts must be 10 each: " + JSON.stringify(counts));
  return { count: input.length, categories: counts, version: IDENTITY_A6_FIXTURE_VERSION };
}
