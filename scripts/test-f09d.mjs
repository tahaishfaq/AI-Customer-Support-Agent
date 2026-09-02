/**
 * F09-D contract smoke — prompt build error handling.
 * Run: npm run test:f09d
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPromptBuildInput,
  buildChatSystemPrompt,
  resolveAnswerStyle,
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
  assert(/Phase D — Error handling ✅/.test(f09), "Phase D marked done");

  assert(resolveAnswerStyle("bogus") === "DETAILED", "malformed answerStyle → DETAILED");

  let threw = false;
  try {
    buildChatSystemPrompt({ agent: { systemPrompt: "   " } });
  } catch (e) {
    threw = true;
    assert(/systemPrompt is required/i.test(e.message), "empty prompt error");
  }
  assert(threw, "empty systemPrompt throws before LLM");

  threw = false;
  try {
    assertPromptBuildInput({ agent: null });
  } catch (e) {
    threw = true;
    assert(/agent is required/i.test(e.message), "missing agent error");
  }
  assert(threw, "missing agent throws");

  assert(
    sanitizeSystemPromptOverlay("hello\u0000world") === "helloworld",
    "null bytes stripped"
  );

  const chat = read("lib/services/chat.service.js");
  assert(/buildChatSystemPrompt/.test(chat), "chat uses builder");
  assert(/Could not build agent prompt|prompt-builder failed/.test(chat), "build fail → 500 path");

  const classify = read("lib/services/ai/classify.js");
  assert(/GENERAL.*NEUTRAL|DEFAULT/.test(classify), "classify fallback preserved");

  assert(/test:f09d/.test(read("package.json")), "npm script");

  console.log("ok  F09-D prompt error handling");
  console.log("\nF09-D smoke passed");
}

main();
