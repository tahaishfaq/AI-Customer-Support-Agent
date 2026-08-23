/**
 * F05 A–H contract smoke — studio train/test/deploy gate.
 * Run: npm run test:f05
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  const f05 = featureDoc(root, "F05");
  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert(
      new RegExp(`Phase ${letter} — .+ ✅`).test(f05),
      `F05 Phase ${letter} should be marked done`
    );
  }
  assert(
    /Ask-yourself|question packs/i.test(f05) &&
      /simulation farm/i.test(f05),
    "F05-A in/out"
  );
  assert(/Per-agent scope/i.test(f05), "F05-A identity");

  const chat = read("lib/services/chat.service.js");
  assert(/usedKnowledge/.test(chat), "chat returns usedKnowledge");
  assert(
    /selectKnowledgeChunks|buildKnowledgeBlock/.test(chat),
    "knowledge block builder"
  );

  const bubble = read("components/chat/MessageBubble.jsx");
  assert(/Used knowledge/.test(bubble), "bubble shows used knowledge");

  const studio = read("components/studio/AgentTestStudio.jsx");
  assert(/expectIncludes/.test(studio), "soft expectIncludes");
  assert(/ResultBadge|Pass/.test(studio), "pass/fail badges");
  assert(/Export run|exportLastRun/.test(studio), "export JSON");
  assert(/flaky/i.test(studio), "flaky marking");
  assert(/MAX_RUN_QUESTIONS\s*=\s*20/.test(studio), "run cap 20");
  assert(/Skipped .* empty/.test(studio), "empty skip toast");
  assert(/429|Rate limit/.test(studio), "rate limit pause");
  assert(/runNextQuestion/.test(studio), "sequential runner");
  assert(!/Promise\.all\(.*sendChatMessage/.test(studio), "no parallel blast");

  const product = read("scripts/test-product.mjs");
  assert(
    /5\s*business\s*days|knowledgePhrase/i.test(product),
    "F03 product FAQ assert still present (F05-G)"
  );

  assert(!/model TestRun/.test(read("prisma/schema.prisma")), "no TestRun table v1");

  console.log("ok  F05 A–H studio test improvements");
  console.log("\nF05 smoke passed");
}

main();
