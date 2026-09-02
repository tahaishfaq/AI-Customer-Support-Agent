/**
 * F02 Phase H smoke — load script + checklist present.
 * Live load: npm run load:f02h (with server + optional F02_PUBLIC_KEY / admin env)
 * Run: npm run test:f02h
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
  const f02 = featureDoc(root, "F02");
  assert(
    /Phase H — Production testing ✅/.test(f02),
    "F02 Phase H should be marked done"
  );
  assert(
    f02.includes("load:f02h") || f02.includes("scripts/load-f02h.mjs"),
    "F02-H must reference load script"
  );
  assert(
    /concurrent|20/i.test(f02) && /origin lock/i.test(f02),
    "F02-H checklist must cover concurrent chats + origin lock"
  );

  assert(
    fs.existsSync(path.join(root, "scripts/load-f02h.mjs")),
    "missing scripts/load-f02h.mjs"
  );
  const load = read("scripts/load-f02h.mjs");
  assert(
    load.includes("CONCURRENCY") &&
      load.includes("F02_PUBLIC_KEY") &&
      load.includes("origin"),
    "load script must hit concurrency + origin checks"
  );

  const pkg = read("package.json");
  assert(
    pkg.includes("load:f02h") && pkg.includes("test:f02h"),
    "package.json must expose load:f02h + test:f02h"
  );
  console.log("ok  Phase H tooling + docs");

  console.log("\nF02-H smoke passed");
  console.log("(Live numbers: npm run load:f02h with server up)");
}

try {
  main();
} catch (error) {
  console.error("\nF02-H smoke FAILED:", error.message);
  process.exit(1);
}
