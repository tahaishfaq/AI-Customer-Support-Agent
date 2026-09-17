import { TENANT_FIXTURES } from "./tenant-fixtures.js";

export const ROUTING_A5_FIXTURE_VERSION = "routing-gate-a5-2026-09-16-v1";

const groups = ["store", "web", "mixed", "general", "capability"];

function makeCase(index, group, query, expectedRoute, overrides = {}) {
  const tenant = TENANT_FIXTURES[index % TENANT_FIXTURES.length];
  return {
    id: "A5-" + String(index + 1).padStart(3, "0"),
    category: group,
    severity: "P1",
    companyPack: "synthetic-" + tenant.pack.toLowerCase(),
    workspaceId: tenant.workspaceId,
    agentId: tenant.agentId,
    customerId: tenant.customerId,
    preconditions: ["synthetic fixture only"],
    conversation: [{ role: "user", content: query }],
    query,
    expectedRoute,
    expectedWeb: expectedRoute === "WEB" || expectedRoute === "MIXED",
    expectedEntities: [],
    capabilities: [],
    expectedCapabilities: [],
    forbiddenCapabilities: [],
    cleanup: ["synthetic fixture only"],
    ...overrides,
  };
}

const cases = [];
function add(group, route, queries, overridesFor = () => ({})) {
  for (const [offset, query] of queries.entries()) {
    cases.push(makeCase(cases.length, group, query, route, overridesFor(offset)));
  }
}

add("store", "STORE", [
  "What are your prices?",
  "What is your return policy?",
  "Is this item in stock?",
  "Check my order status.",
  "What are your plans?",
  "How long is delivery?",
  "Do you offer refunds?",
  "What is the warranty?",
  "Can I cancel my subscription?",
  "What are your support hours?",
]);

add("web", "WEB", [
  "Search online for current Shopify pricing.",
  "Look up current Botpress plans on the internet.",
  "Google the latest Zendesk pricing.",
  "Browse the web for current Intercom pricing.",
  "Search the internet for today's AI support news.",
  "Find current OpenAI API prices online.",
  "Look online for Salesforce service plans.",
  "From the web, what are Microsoft's current support features?",
  "Search online for current ecommerce trends.",
  "Internet search the latest customer service regulations.",
]);

add("mixed", "MIXED", [
  "Compare your plans with Shopify online.",
  "Compare your return policy with the online policy.",
  "Your prices versus current Botpress pricing.",
  "What is the difference between your shipping and online shipping?",
  "Compare our features with Zendesk on the web.",
  "Compare your support hours with online competitors.",
  "Our subscription versus Intercom's current plan.",
  "Compare this store's warranty with what is online.",
  "How do your refunds compare with Shopify's policy?",
  "Compare our delivery options versus online options.",
]);

add("general", "GENERAL", [
  "What is an API?",
  "Explain OAuth in simple words.",
  "How does caching work?",
  "What is retrieval augmented generation?",
  "Why are webhooks useful?",
  "Define rate limiting.",
  "How does encryption protect data?",
  "What is a database index?",
  "Explain the difference between HTTP and HTTPS.",
  "How do queues help background jobs?",
]);

const capabilityCases = [
  ["What is the price of my plan?", ["PLANS"], ["plans_lookup"], ["refund_order", "web_search"]],
  ["How do I sign up?", ["SIGNUP"], ["signup_help"], ["refund_order", "web_search"]],
  ["Check my order status.", ["SUPPORT"], ["order_lookup"], ["plans_lookup", "web_search"]],
  ["I need a refund for my order.", ["SUPPORT"], ["refund_order"], ["plans_lookup", "web_search"]],
  ["What plans do you offer and how do I sign up?", ["PLANS", "SIGNUP"], ["plans_lookup", "signup_help"], ["refund_order", "web_search"]],
  ["Search online for Shopify plans.", ["PLANS"], ["web_search"], ["refund_order", "plans_lookup"]],
  ["What is an API?", [], [], ["refund_order", "plans_lookup", "web_search"]],
  ["Compare our plans with Shopify.", ["PLANS"], ["plans_lookup", "web_search"], ["refund_order"]],
  ["Track my shipment.", ["SUPPORT"], ["order_lookup"], ["plans_lookup", "web_search"]],
  ["What are your current features?", ["PLANS"], ["plans_lookup"], ["refund_order", "web_search"]],
];

for (const [offset, [query, entities, expectedCapabilities, forbiddenCapabilities]] of capabilityCases.entries()) {
  cases.push(makeCase(cases.length, "capability", query, query.startsWith("Search online") ? "WEB" : query.startsWith("Compare") ? "MIXED" : query === "What is an API?" ? "GENERAL" : "STORE", {
    expectedEntities: entities,
    expectedCapabilities,
    forbiddenCapabilities,
    capabilities: [
      { name: "web_search", riskLevel: "READ", entities: ["PLANS"] },
      { name: "plans_lookup", riskLevel: "READ", entities: ["PLANS"] },
      { name: "signup_help", riskLevel: "READ", entities: ["SIGNUP"] },
      { name: "order_lookup", riskLevel: "READ", entities: ["SUPPORT"] },
      { name: "refund_order", riskLevel: "WRITE", entities: ["SUPPORT"] },
    ],
  }));
}

export const ROUTING_A5_CASES = Object.freeze(cases);

export function validateRoutingA5Catalog(input = ROUTING_A5_CASES) {
  if (!Array.isArray(input) || input.length !== 50) {
    throw new Error("A5 requires exactly 50 routing cases; received " + (input?.length || 0));
  }
  const ids = new Set();
  for (const item of input) {
    if (!/^A5-\d{3}$/.test(item.id)) throw new Error("Invalid A5 id: " + item.id);
    if (ids.has(item.id)) throw new Error("Duplicate A5 id: " + item.id);
    ids.add(item.id);
    for (const field of ["workspaceId", "agentId", "customerId", "query", "expectedRoute", "cleanup"]) {
      if (!(field in item)) throw new Error(item.id + " missing " + field);
    }
  }
  const counts = Object.fromEntries(groups.map((group) => [group, input.filter((item) => item.category === group).length]));
  if (Object.values(counts).some((count) => count !== 10)) throw new Error("A5 category counts must be 10 each: " + JSON.stringify(counts));
  return { count: input.length, categories: counts, version: ROUTING_A5_FIXTURE_VERSION };
}
