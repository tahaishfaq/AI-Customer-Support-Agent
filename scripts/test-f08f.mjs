/**
 * F08-F contract smoke — scaling notes (F10 threshold, no cache).
 * Run: npm run test:f08f
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  F10_CHARS_THRESHOLD,
  F10_DOC_THRESHOLD,
} from "../lib/services/ai/knowledge-retrieve.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function main() {
  const f08 = featureDoc(root, "F08");
  assert(/Phase F — Scaling ✅/.test(f08), "Phase F marked done");
  assert(/> 40|F10_DOC_THRESHOLD|40 docs/i.test(f08), "doc threshold");
  assert(/80k|F10_CHARS_THRESHOLD/i.test(f08), "chars threshold");
  assert(/no cache|No .*cache|cache.*deferred|Skip in F08/i.test(f08), "no cache");

  const mod = read("lib/services/ai/knowledge-retrieve.js");
  assert(/F10_DOC_THRESHOLD\s*=\s*40/.test(mod), "F10_DOC_THRESHOLD");
  assert(/F10_CHARS_THRESHOLD\s*=\s*80_000/.test(mod), "F10_CHARS_THRESHOLD");
  assert(/No in-process chunk cache/i.test(mod), "cache deferred comment");
  assert(!/Map<.*agentId|chunkCache|CHUNK_CACHE/.test(mod), "no chunk cache Map");

  assert(F10_DOC_THRESHOLD === 40, "doc threshold value");
  assert(F10_CHARS_THRESHOLD === 80_000, "chars threshold value");

  assert(!/"ioredis"|"@upstash\/redis"/.test(read("package.json")), "no redis dep for F08");
  assert(/test:f08f/.test(read("package.json")), "npm script");

  console.log("ok  F08-F scaling / F10 threshold");
  console.log("\nF08-F smoke passed");
}

main();
