import assert from "node:assert/strict";
import {
  decidePublicEvidence,
  filterRedundantPublicReads,
  isSuppressiblePublicRead,
} from "../lib/services/ai/public-evidence.js";
import { routeSource } from "../lib/services/ai/source-policy.js";

const origin = "https://aide.example";
assert.equal(routeSource("What are your plans?").route, "STORE");
const docs = [
  {
    id: "pricing-page",
    type: "WEB",
    sourceUrl: `${origin}/pricing`,
    origin,
    content: "AIDE plans and pricing: Free $0 monthly and Pro $20/month.",
  },
];

const publicRead = {
  name: "get_public_plans",
  accessClass: "PUBLIC_READ",
  riskLevel: "READ",
  identityMode: "OWNER_KEY",
  requiresIdentity: false,
};

assert.equal(
  decidePublicEvidence({
    query: "What are your plans?",
    route: "STORE",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "DONE",
  }).sufficient,
  true
);
assert.equal(
  decidePublicEvidence({
    query: "What is my current plan?",
    route: "STORE",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "DONE",
  }).sufficient,
  false,
  "personal billing must not be answered through public evidence suppression"
);
assert.equal(
  decidePublicEvidence({
    query: "What are your latest plans?",
    route: "STORE",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "DONE",
  }).sufficient,
  false,
  "freshness-sensitive asks must remain eligible for a live source"
);
assert.equal(
  decidePublicEvidence({
    query: "What are your plans?",
    route: "STORE",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "PARTIAL",
  }).sufficient,
  false,
  "partial crawls must not be treated as fresh complete evidence"
);
assert.equal(
  decidePublicEvidence({
    query: "What are the yearly plan prices in USD?",
    route: "STORE",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "DONE",
  }).sufficient,
  false,
  "requested yearly and currency detail must be present in evidence"
);
assert.equal(
  decidePublicEvidence({
    query: "What are the monthly plan prices in USD?",
    route: "STORE",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "DONE",
  }).sufficient,
  true,
  "matching interval and currency evidence may suppress a redundant read"
);
assert.equal(
  decidePublicEvidence({
    query: "What are your plans?",
    route: "STORE",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "DONE",
    crawlStale: true,
  }).sufficient,
  false,
  "scheduled stale crawls must remain eligible for a live source"
);
assert.equal(isSuppressiblePublicRead(publicRead), true);
assert.equal(
  isSuppressiblePublicRead({ ...publicRead, identityMode: "END_USER_TOKEN" }),
  false
);
assert.deepEqual(
  filterRedundantPublicReads(
    [publicRead, { ...publicRead, name: "account_plan", identityMode: "END_USER_TOKEN" }],
    new Set(["get_public_plans", "account_plan"])
  ).map((action) => action.name),
  ["account_plan"]
);
assert.equal(
  decidePublicEvidence({
    query: "Search the internet for current plan prices",
    route: "WEB",
    selectedUsed: [{ id: "pricing-page" }],
    knowledgeDocs: docs,
    siteKnowledgeOrigin: origin,
    crawlStatus: "DONE",
  }).sufficient,
  false,
  "web route must not be replaced by stored evidence"
);

// A stray amount or a "pricing not specified" summary is not plan evidence (crawled FAQ case).
for (const content of [
  "## FAQ - **Pricing**: Not specified, but mentions a payout of $12,450.00.",
  "Our plans are flexible. Creators earned $12,450.00 last month on campaigns.",
]) {
  const doc = { id: "weak", type: "WEB", sourceUrl: `${origin}/`, content };
  assert.equal(
    decidePublicEvidence({ query: "What plans do you offer?", route: "STORE", selectedUsed: [doc], knowledgeDocs: [doc], siteKnowledgeOrigin: origin, crawlStatus: "DONE" }).sufficient,
    false,
    `weak evidence must not hide the plans tool: ${content}`
  );
}

console.log("PASS public evidence routing: bounded suppression, personal/live safeguards, and action filtering");
