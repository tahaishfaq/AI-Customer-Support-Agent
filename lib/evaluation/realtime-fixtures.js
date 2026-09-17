import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const REALTIME_A10_FIXTURE_VERSION = "realtime-gate-a10-2026-09-16-v1";
const groups = ["activity_state", "stream_lifecycle", "handoff", "accessibility"];
const cases = [];

for (const category of groups) {
  for (let offset = 0; offset < 10; offset += 1) {
    const tenant = TENANT_FIXTURES[(cases.length + offset) % TENANT_FIXTURES.length];
    cases.push({
      id: "A10-" + String(cases.length + 1).padStart(3, "0"),
      category,
      severity: category === "handoff" ? "P0" : "P1",
      companyPack: "synthetic-" + tenant.pack.toLowerCase(),
      workspaceId: tenant.workspaceId,
      agentId: tenant.agentId,
      customerId: tenant.customerId,
      variant: offset,
      preconditions: ["synthetic fixture only"],
      conversation: [{ role: "user", content: "synthetic realtime case " + (offset + 1) }],
      cleanup: ["synthetic fixture only"],
    });
  }
}

export const REALTIME_A10_CASES = Object.freeze(cases);

export function validateRealtimeA10Catalog(input = REALTIME_A10_CASES) {
  if (!Array.isArray(input) || input.length !== 40) {
    throw new Error("A10 requires exactly 40 realtime cases; received " + (input?.length || 0));
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^A10-\d{3}$/.test(item.id)) throw new Error("Invalid A10 id: " + item.id);
    if (ids.has(item.id)) throw new Error("Duplicate A10 id: " + item.id);
    ids.add(item.id);
    for (const field of ["workspaceId", "agentId", "customerId", "variant", "cleanup"]) {
      if (!(field in item)) throw new Error(item.id + " missing " + field);
    }
  }
  const counts = Object.fromEntries(groups.map((group) => [group, input.filter((item) => item.category === group).length]));
  if (Object.values(counts).some((count) => count !== 10)) throw new Error("A10 category counts must be 10 each: " + JSON.stringify(counts));
  return { count: input.length, categories: counts, version: REALTIME_A10_FIXTURE_VERSION };
}
