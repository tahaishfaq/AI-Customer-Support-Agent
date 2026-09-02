/**
 * F08 A–H umbrella smoke.
 * Run: npm run test:f08
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
  const f08 = featureDoc(root, "F08");
  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert(
      new RegExp(`Phase ${letter} — .+ ✅`).test(f08),
      `F08 Phase ${letter} should be marked done`
    );
  }

  for (const script of [
    "test-f08a.mjs",
    "test-f08b.mjs",
    "test-f08c.mjs",
    "test-f08d.mjs",
    "test-f08e.mjs",
    "test-f08f.mjs",
    "test-f08g.mjs",
    "test-f08-fuzzy.mjs",
  ]) {
    run(script);
  }

  const product = read("scripts/test-product.mjs");
  assert(
    /5\s*business\s*days|knowledgePhrase|refund/i.test(product),
    "product smoke still asserts knowledge phrase (F08-H)"
  );

  const chat = read("lib/services/chat.service.js");
  assert(/selectKnowledgeChunks/.test(chat), "chat uses retrieve");
  assert(/usedKnowledge/.test(chat), "usedKnowledge for studio");

  assert(/test:f08/.test(read("package.json")), "npm run test:f08");

  console.log("ok  F08 A–H knowledge retrieval (stuffing lite)");
  console.log("\nF08 smoke passed");
}

main();
