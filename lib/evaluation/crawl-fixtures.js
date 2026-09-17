import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const CRAWL_A9_FIXTURE_VERSION = "crawl-gate-a9-2026-09-16-v1";
const groups = ["transport_security", "discovery", "freshness", "retrieval"];
const cases = [];

for (const category of groups) {
  for (let offset = 0; offset < 10; offset += 1) {
    const tenant = TENANT_FIXTURES[(cases.length + offset) % TENANT_FIXTURES.length];
    cases.push({
      id: "A9-" + String(cases.length + 1).padStart(3, "0"),
      category,
      severity: category === "transport_security" ? "P0" : "P1",
      companyPack: "synthetic-" + tenant.pack.toLowerCase(),
      workspaceId: tenant.workspaceId,
      agentId: tenant.agentId,
      customerId: tenant.customerId,
      preconditions: ["synthetic fixture only", "no external mutation"],
      conversation: [{ role: "user", content: "synthetic crawl case " + (offset + 1) }],
      cleanup: ["synthetic fixture only"],
      variant: offset,
    });
  }
}

export const CRAWL_A9_CASES = Object.freeze(cases);

export function validateCrawlA9Catalog(input = CRAWL_A9_CASES) {
  if (!Array.isArray(input) || input.length !== 40) {
    throw new Error("A9 requires exactly 40 crawl cases; received " + (input?.length || 0));
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^A9-\d{3}$/.test(item.id)) throw new Error("Invalid A9 id: " + item.id);
    if (ids.has(item.id)) throw new Error("Duplicate A9 id: " + item.id);
    ids.add(item.id);
    for (const field of ["workspaceId", "agentId", "customerId", "variant", "cleanup"]) {
      if (!(field in item)) throw new Error(item.id + " missing " + field);
    }
  }
  const counts = Object.fromEntries(groups.map((group) => [group, input.filter((item) => item.category === group).length]));
  if (Object.values(counts).some((count) => count !== 10)) throw new Error("A9 category counts must be 10 each: " + JSON.stringify(counts));
  return { count: input.length, categories: counts, version: CRAWL_A9_FIXTURE_VERSION };
}
