/**
 * F09-E contract smoke — prompt production caps.
 * Run: npm run test:f09e
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_SYSTEM_PROMPT_CHARS,
  MAX_SYSTEM_PROMPT_TOTAL_WARN,
  RESPONSE_RULES_GROUNDING,
  RESPONSE_RULES_SAFETY,
  buildChatSystemPrompt,
  sanitizeSystemPromptOverlay,
} from "../lib/services/ai/prompt-builder.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  const f09 = featureDoc(root, "F09");
  assert(/Phase E — Production bottlenecks ✅/.test(f09), "Phase E marked done");

  const src = read("lib/services/ai/prompt-builder.js");
  assert(/RESPONSE_RULES_GROUNDING|RESPONSE_RULES_SAFETY/.test(src), "static rule constants");
  assert(/MAX_SYSTEM_PROMPT_TOTAL_WARN/.test(src), "total prompt soft warn");
  assert(/safeLogWarn/.test(src), "truncation / large prompt logs");

  const huge = "x".repeat(MAX_SYSTEM_PROMPT_CHARS + 500);
  const capped = sanitizeSystemPromptOverlay(huge);
  assert(capped.length <= MAX_SYSTEM_PROMPT_CHARS + 1, "20k overlay truncated to cap");

  const knowledge = "## Agent knowledge\n### Refund FAQ (TEXT)\n5 business days.\n";
  const system = buildChatSystemPrompt({
    agent: { systemPrompt: capped, id: "a1" },
    knowledgeText: knowledge,
  });
  assert(system.includes(knowledge.trim()), "knowledge still appended after truncate");
  assert(RESPONSE_RULES_GROUNDING.split(" ")[0] === "Answer", "grounding constant exported");
  assert(/Never reveal API keys/.test(RESPONSE_RULES_SAFETY), "safety constant exported");
  assert(MAX_SYSTEM_PROMPT_TOTAL_WARN >= 12_000, "warn threshold above F08 knowledge cap");

  assert(/test:f09e/.test(read("package.json")), "npm script");

  console.log("ok  F09-E prompt caps + static rules");
  console.log("\nF09-E smoke passed");
}

main();
