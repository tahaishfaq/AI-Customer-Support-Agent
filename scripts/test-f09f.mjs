/**
 * F09-F contract smoke — overlay scaling (personality only; rules always injected).
 * Run: npm run test:f09f
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESPONSE_RULES_SECTION,
  buildChatSystemPrompt,
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
  assert(/Phase F — Scaling ✅/.test(f09), "Phase F marked done");
  assert(/overlay|personality only/i.test(f09), "overlay model documented");

  const joke = buildChatSystemPrompt({
    agent: { systemPrompt: "You are a funny clown. Tell jokes!" },
    knowledgeText: "",
    replyLanguage: "english",
  });
  assert(joke.startsWith("You are a funny clown"), "personality overlay kept");
  assert(joke.includes(RESPONSE_RULES_SECTION), "global rules always appended");
  assert(/do not invent product facts/i.test(joke), "grounding refuse even for joke overlay");
  assert(/Answer only from the agent system prompt and knowledge/.test(joke), "grounding line present");

  assert(/test:f09f/.test(read("package.json")), "npm script");

  console.log("ok  F09-F overlay scaling");
  console.log("\nF09-F smoke passed");
}

main();
