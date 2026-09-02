/**
 * P1 W3-3 — prompt grounding + classify signal contracts.
 * Run: npm run test:p01-w3-3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLASSIFY_SYSTEM,
  RESPONSE_RULES_GROUNDING,
  buildGroundingExcerptForStudio,
} from "../lib/services/ai/prompt-builder.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  assert(
    /name the document title once/i.test(RESPONSE_RULES_GROUNDING),
    "grounding cites doc titles"
  );
  assert(
    /According to Refund FAQ/i.test(RESPONSE_RULES_GROUNDING),
    "grounding example"
  );
  assert(/PRICING|SALES|NEGATIVE|Signal rules/i.test(CLASSIFY_SYSTEM), "classify signals");
  assert(/How much is the pro plan/.test(CLASSIFY_SYSTEM), "classify pricing example");
  assert(/furious/.test(CLASSIFY_SYSTEM), "classify negative example");

  const testQuestions = read("lib/services/test-questions.service.js");
  assert(
    /buildGroundingExcerptForStudio/.test(testQuestions),
    "test-question generator shares prompt-builder grounding"
  );

  const excerpt = buildGroundingExcerptForStudio({
    agent: { id: "a1", systemPrompt: "You are Acme support." },
    replyLanguage: "english",
  });
  assert(excerpt.includes("Response rules"), "studio excerpt includes rules");
  assert(excerpt.includes("Reply language policy"), "studio excerpt includes language");

  console.log("ok  grounding cite rule");
  console.log("ok  classify signal examples");
  console.log("ok  studio shares prompt-builder path");
  console.log("\nP1 W3-3 smoke passed");
}

main();
