import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const RECOVERY_A8_FIXTURE_VERSION = "recovery-gate-a8-2026-09-16-v1";
const groups = ["confirmation", "idempotency", "retry", "replay_budget", "recovery_handoff"];
const cases = [];

for (const category of groups) {
  for (let offset = 0; offset < 10; offset += 1) {
    const tenant = TENANT_FIXTURES[(cases.length + offset) % TENANT_FIXTURES.length];
    cases.push({
      id: "A8-" + String(cases.length + 1).padStart(3, "0"),
      category,
      severity: category === "confirmation" || category === "idempotency" ? "P0" : "P1",
      companyPack: "synthetic-" + tenant.pack.toLowerCase(),
      workspaceId: tenant.workspaceId,
      agentId: tenant.agentId,
      customerId: tenant.customerId,
      conversationId: "conversation-" + tenant.agentId,
      actionId: "action-" + tenant.agentId,
      preconditions: ["synthetic fixture only"],
      conversation: [{ role: "user", content: "synthetic recovery case " + (offset + 1) }],
      cleanup: ["synthetic fixture only"],
    });
  }
}

export const RECOVERY_A8_CASES = Object.freeze(cases);

export function validateRecoveryA8Catalog(input = RECOVERY_A8_CASES) {
  if (!Array.isArray(input) || input.length !== 50) {
    throw new Error("A8 requires exactly 50 recovery cases; received " + (input?.length || 0));
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^A8-\d{3}$/.test(item.id)) throw new Error("Invalid A8 id: " + item.id);
    if (ids.has(item.id)) throw new Error("Duplicate A8 id: " + item.id);
    ids.add(item.id);
    for (const field of ["workspaceId", "agentId", "customerId", "conversationId", "actionId", "cleanup"]) {
      if (!(field in item)) throw new Error(item.id + " missing " + field);
    }
  }
  const counts = Object.fromEntries(groups.map((group) => [group, input.filter((item) => item.category === group).length]));
  if (Object.values(counts).some((count) => count !== 10)) throw new Error("A8 category counts must be 10 each: " + JSON.stringify(counts));
  return { count: input.length, categories: counts, version: RECOVERY_A8_FIXTURE_VERSION };
}
