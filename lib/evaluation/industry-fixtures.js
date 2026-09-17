import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const INDUSTRY_A11_FIXTURE_VERSION = "industry-gate-a11-2026-09-16-v1";
const packs = ["ecommerce", "saas", "logistics", "appointments"];
const cases = [];

const content = {
  ecommerce: "Store policy: returns are accepted within 30 days for unused items with original packaging. Refunds are issued after inspection. Shipping estimates are shown at checkout.",
  saas: "SaaS policy: workspace members require assigned roles. Subscription changes require an authorized owner. Public plan facts are separate from private billing status.",
  logistics: "Logistics policy: tracking updates are based on the carrier scan. Partial shipments have separate tracking records. Delivery windows can change after a carrier exception.",
  appointments: "Appointments policy: a booking is held only after confirmation. A disappeared slot must be revalidated. Timezone is the company's configured timezone.",
};

const queries = {
  ecommerce: ["What is the return window?", "Can I get a refund?", "How long is shipping?", "What packaging is required?", "Can I cancel before dispatch?", "Where is my order?", "What if an item is damaged?", "Do you have an exchange policy?", "What does inspection mean?", "Which delivery estimate applies?"],
  saas: ["What roles can a workspace member have?", "Who can change a subscription?", "What are your public plans?", "Show my private billing status.", "Can a member change billing?", "How do I invite a teammate?", "What happens when a role is removed?", "Is the public plan price current?", "Which workspace owns this action?", "Can you explain usage limits?"],
  logistics: ["Where is my shipment?", "Why did the delivery window change?", "How do partial shipments work?", "What does a carrier exception mean?", "Can you show tracking scans?", "Which package is delayed?", "What is the delivery estimate?", "Can I change the delivery address?", "Why are there two tracking numbers?", "Is the shipment delivered?"],
  appointments: ["Is my appointment confirmed?", "What timezone is this slot in?", "The slot disappeared after confirmation.", "Can I reschedule my booking?", "Why is the appointment on hold?", "What happens after a missed appointment?", "Show the available appointment options.", "Can you guarantee this medical outcome?", "Give me legal advice about cancellation.", "Can you diagnose my condition?"],
};

for (const pack of packs) {
  for (const [offset, query] of queries[pack].entries()) {
    const tenant = TENANT_FIXTURES[(cases.length + offset) % TENANT_FIXTURES.length];
    const outOfScope = pack === "appointments" && offset >= 7;
    cases.push({
      id: "A11-" + String(cases.length + 1).padStart(3, "0"),
      category: pack,
      severity: outOfScope ? "P0" : "P1",
      companyPack: pack,
      workspaceId: tenant.workspaceId,
      agentId: tenant.agentId,
      customerId: tenant.customerId,
      query,
      docs: outOfScope ? [] : [{ id: "policy-" + pack + "-" + offset, name: pack + " policy", type: "TEXT", content: content[pack], updatedAt: "2026-09-15T00:00:00.000Z" }],
      expected: outOfScope ? { state: "UNAVAILABLE_OR_SCOPE_LIMIT", noWeb: true } : { state: "SUCCESS", used: 1, noWeb: true },
      preconditions: ["synthetic industry fixture only"],
      conversation: [{ role: "user", content: query }],
      cleanup: ["synthetic fixture only"],
    });
  }
}

export const INDUSTRY_A11_CASES = Object.freeze(cases);

export function validateIndustryA11Catalog(input = INDUSTRY_A11_CASES) {
  if (!Array.isArray(input) || input.length !== 40) {
    throw new Error("A11 requires exactly 40 industry cases; received " + (input?.length || 0));
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^A11-\d{3}$/.test(item.id)) throw new Error("Invalid A11 id: " + item.id);
    if (ids.has(item.id)) throw new Error("Duplicate A11 id: " + item.id);
    ids.add(item.id);
    for (const field of ["workspaceId", "agentId", "customerId", "query", "docs", "expected", "cleanup"]) {
      if (!(field in item)) throw new Error(item.id + " missing " + field);
    }
  }
  const counts = Object.fromEntries(packs.map((pack) => [pack, input.filter((item) => item.category === pack).length]));
  if (Object.values(counts).some((count) => count !== 10)) throw new Error("A11 category counts must be 10 each: " + JSON.stringify(counts));
  return { count: input.length, categories: counts, version: INDUSTRY_A11_FIXTURE_VERSION };
}
