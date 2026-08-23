/**
 * F09 A–H umbrella smoke.
 * Run: npm run test:f09
 */
import { spawnSync } from "node:child_process";
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

function run(script) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script)], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`${script} failed`);
  }
  process.stdout.write(result.stdout || "");
}

function main() {
  const f09 = featureDoc(root, "F09");
  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert(
      new RegExp(`Phase ${letter} — .+ ✅`).test(f09),
      `F09 Phase ${letter} should be marked done`
    );
  }

  for (const script of [
    "test-f09a.mjs",
    "test-f09b.mjs",
    "test-f09c.mjs",
    "test-f09d.mjs",
    "test-f09e.mjs",
    "test-f09f.mjs",
    "test-f09g.mjs",
  ]) {
    run(script);
  }

  const chat = read("lib/services/chat.service.js");
  assert(/buildChatSystemPrompt/.test(chat), "chat uses prompt-builder");
  assert(/formatClarifyQuestion|resolveRetrieveQuery/.test(chat), "F08 clarify path kept");
  assert(/selectKnowledgeChunks/.test(chat), "F08 retrieve still wired");

  const retrieve = read("lib/services/ai/knowledge-retrieve.js");
  assert(/expandQueryTokensWithFuzzy|findTypoClarifications/.test(retrieve), "F08 fuzzy intact");

  const classify = read("lib/services/ai/classify.js");
  assert(/CLASSIFY_SYSTEM/.test(classify), "hardened classify system");

  const product = read("scripts/test-product.mjs");
  assert(/refund|knowledge/i.test(product), "product smoke still knowledge-aware");

  assert(/test:f09/.test(read("package.json")), "npm run test:f09");

  console.log("ok  F09 A–H prompts & guidance lite");
  console.log("\nF09 smoke passed");
}

main();
