import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const MANDATORY_R13_FIXTURE_VERSION = "mandatory-gate-a13-2026-09-16-v1";

const groups = [
  ["routing", ["Roman Urdu latest plans", "Explicit online Shopify pricing", "Store vs Shopify comparison", "API definition", "Plans and signup", "Ambiguous price", "Empty knowledge", "Stale versus live fact", "Wrong entity result", "HTTP 200 error object"]],
  ["identity", ["Anonymous private order", "Role claim", "Cross-customer order", "Same email two tenants", "Public key private proof", "Revoked identity", "Account switch", "Screenshot order id", "Member billing role", "Deleted private source"]],
  ["writes", ["Ambiguous cancellation", "Double confirmation", "Two tabs approval", "Changed amount", "Lost write response", "Crash before dispatch", "Crash after dispatch", "Pending refund", "Notification failure", "Stop during action"]],
  ["crawl", ["JavaScript-only site", "Missing sitemap", "Robots denial", "Redirect loop", "Page 429", "Page cap", "Pricing table", "Locale variants", "Page injection", "Partial crawl done"]],
  ["policy", ["Urdu policy", "Ambiguous currency", "Timezone deadline", "Disappeared slot", "Partial shipment", "B2B negotiated price", "Regulated scope", "Multiple requests", "Repeated clarification", "Unsupported capability"]],
  ["streaming", ["Activity before placeholder", "Duplicate activity", "Terminal regression", "Lost done event", "Reconnect action", "Refresh confirmation", "Human joins generation", "Human takeover write", "No human available", "Scroll during stream", "Keyboard screen reader", "320px viewport", "Partial markdown", "Reduced motion"]],
  ["provider", ["Provider 429", "Slow upstream", "Tool budget", "Worker crawl restart", "Large upload", "Duplicate webhook", "Queue backlog", "Tenant traffic spike"]],
];

const cases = [];
for (const [category, names] of groups) {
  for (const name of names) {
    const index = cases.length;
    const tenant = TENANT_FIXTURES[index % TENANT_FIXTURES.length];
    cases.push({
      id: `R${String(index + 1).padStart(2, "0")}`,
      category,
      name,
      severity: category === "identity" || category === "writes" ? "P0" : "P1",
      workspaceId: tenant.workspaceId,
      agentId: tenant.agentId,
      customerId: tenant.customerId,
      preconditions: ["synthetic/local contract only"],
      cleanup: ["no remote side effect"],
    });
  }
}

export const MANDATORY_R13_CASES = Object.freeze(cases);

export function validateMandatoryR13Catalog(input = MANDATORY_R13_CASES) {
  if (!Array.isArray(input) || input.length !== 72) {
    throw new Error(`A13 requires exactly 72 mandatory cases; received ${input?.length || 0}`);
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^R\d{2}$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate mandatory id: ${item.id}`);
    ids.add(item.id);
    for (const field of ["category", "workspaceId", "agentId", "customerId", "preconditions", "cleanup"]) {
      if (!(field in item)) throw new Error(`${item.id} missing ${field}`);
    }
  }
  const counts = Object.fromEntries(groups.map(([category]) => [category, input.filter((item) => item.category === category).length]));
  if (Object.values(counts).some((count) => count !== (counts.streaming === count ? 14 : 10))) {
    // The streaming group is intentionally 14; all other groups are 10 or 8.
    if (counts.routing !== 10 || counts.identity !== 10 || counts.writes !== 10 || counts.crawl !== 10 || counts.policy !== 10 || counts.streaming !== 14 || counts.provider !== 8) {
      throw new Error(`Unexpected mandatory category counts: ${JSON.stringify(counts)}`);
    }
  }
  return { count: input.length, categories: counts, version: MANDATORY_R13_FIXTURE_VERSION };
}
