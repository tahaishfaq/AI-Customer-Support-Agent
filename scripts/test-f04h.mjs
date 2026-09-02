/**
 * F04-H — production visual checklist contracts.
 * Run: npm run test:f04h
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
  const f04 = featureDoc(root, "F04");
  assert(/Phase H — Production testing ✅/.test(f04), "F04-H marked done");
  assert(/375/.test(f04) && /1280/.test(f04), "responsive widths");
  assert(/\/w\/\{/.test(f04) || /\/w\/\{key\}/.test(f04) || /\/w\/\{publicKey\}/.test(f04) || /live `\/w\//.test(f04), "embed live check");
  assert(/Brand test/i.test(f04) && /sidebar/i.test(f04), "brand test without sidebar");

  for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    assert(
      new RegExp(`Phase ${letter} — .+ ✅`).test(f04),
      `F04 Phase ${letter} should be ✅`
    );
  }

  console.log("ok  F04-H checklist + all phases done");
  console.log("\nF04-H smoke passed");
}

main();
