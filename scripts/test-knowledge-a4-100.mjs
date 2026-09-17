import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { routeSource } from "../lib/services/ai/source-policy.js";
import { buildKnowledgeEvidence } from "../lib/services/ai/evidence-bundle.js";
import { selectKnowledgeChunks } from "../lib/services/ai/knowledge-retrieve.js";
import { detectInjectionSignals, fenceUntrustedText } from "../lib/actions/untrusted-result.js";
import { KNOWLEDGE_A4_CASES, validateKnowledgeA4Catalog } from "../lib/evaluation/knowledge-fixtures.js";

const catalog = validateKnowledgeA4Catalog();
const results = [];
let assertions = 0;
const check = (value, message) => { assertions += 1; assert(value, message); };

function runCase(item) {
  const route = routeSource(item.query);
  const routingIsIsolated = ["fuzzy_paraphrase", "private_deleted", "document_injection", "provenance", "unsupported_clarify"].includes(item.category);
  if (!routingIsIsolated) check(route.route === "STORE", item.id + " must use STORE route");
  check(route.mayInvokeWebSearch === false, item.id + " must not invoke web search");
  const selected = selectKnowledgeChunks({ docs: item.docs, query: item.query, maxChars: 12000 });

  if (item.category === "empty" || item.category === "private_deleted") {
    const evidence = buildKnowledgeEvidence({ used: selected.used, docs: item.docs, route: "STORE", crawlStatus: item.crawlStatus });
    check(evidence.state === "UNAVAILABLE", item.id + " unavailable evidence");
    check(selected.used.length === 0 && selected.text === "", item.id + " empty retrieval");
  } else if (item.category === "partial_stale") {
    const evidence = buildKnowledgeEvidence({ used: selected.used.length ? selected.used : [{ id: item.docs[0].id }], docs: item.docs, route: "STORE", crawlStatus: item.crawlStatus, crawlStale: item.crawlStale });
    check(evidence.state === "PARTIAL", item.id + " partial evidence");
    check(selected.used.length >= 1, item.id + " retrieves partial document");
  } else if (item.category === "document_injection") {
    check(selected.used.length >= 1, item.id + " retrieves document");
    const signals = detectInjectionSignals(item.docs[0].content);
    const fenced = fenceUntrustedText(item.docs[0].content, { source: "knowledge" });
    check(signals.length >= 1, item.id + " detects document injection");
    check(fenced.includes("UNTRUSTED_KNOWLEDGE_DATA") && fenced.includes("neutralized-instruction-like-text"), item.id + " fences document data");
  } else if (item.category === "provenance" || item.category === "conflict_precedence") {
    check(selected.used.length >= 1, item.id + " retrieves source");
    const evidence = buildKnowledgeEvidence({ used: selected.used, docs: item.docs, route: "STORE", crawlStatus: "DONE" });
    check(evidence.state === "SUCCESS", item.id + " success evidence");
    check(evidence.sources.some((source) => source.sourceTime), item.id + " source time present");
    if (item.category === "provenance") check(evidence.sources.some((source) => source.origin), item.id + " origin present");
  } else if (item.category === "chunk_budget") {
    check(selected.used.length >= 1, item.id + " retrieves large document");
    check(selected.text.length <= 12000, item.id + " respects knowledge budget");
    check(selected.text.includes("Document DATA only"), item.id + " includes untrusted knowledge banner");
  } else if (item.category === "unsupported_clarify") {
    check(route.mayInvokeWebSearch === false, item.id + " does not use web for ambiguity");
    check(selected.used.length === 0 || selected.text.length > 0, item.id + " has an explicit retrieval outcome");
  } else {
    check(selected.used.length >= 1, item.id + " retrieves multilingual/fuzzy knowledge");
    check(selected.text.includes("Agent knowledge"), item.id + " returns knowledge context");
  }
  return { id: item.id, category: item.category, result: "PASS", evidenceStatus: "VERIFIED" };
}

for (const item of KNOWLEDGE_A4_CASES) {
  try {
    results.push(runCase(item));
  } catch (error) {
    results.push({ id: item.id, category: item.category, result: "FAIL", evidenceStatus: "VERIFIED", error: error.message });
  }
}

const failures = results.filter((item) => item.result !== "PASS");
const report = {
  gate: "A4",
  fixtureCatalog: { ...catalog, sanitized: true, liveProviders: false, staging: false },
  assertions,
  results,
  evidence: "local-contract",
  limitations: ["Does not prove live JavaScript rendering, PDF extraction, scheduled crawling, or live provider freshness."],
};
const serialized = JSON.stringify(report);
for (const forbidden of ["transcript", "rawProviderBody", "password", "secret"]) check(!serialized.includes("\\\"" + forbidden + "\\\""), "report does not contain " + forbidden);
fs.mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), ".tmp", "aide-knowledge-a4-results.json"), JSON.stringify(report, null, 2) + "\n");
if (failures.length) {
  console.error("A4 knowledge matrix failed: " + failures.length + "/100");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("A4 knowledge matrix passed: " + results.length + "/100 cases, " + assertions + " assertions.");
console.log(JSON.stringify({ ...catalog, reportPath: ".tmp/aide-knowledge-a4-results.json", evidence: report.evidence }, null, 2));
