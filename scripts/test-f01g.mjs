/**
 * F01 Phase G smoke — README documents Vercel log filter + LOG_LEVEL.
 * Run: npm run test:f01g
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
  const readme = read("README.md");
  assert(
    /Logs/i.test(readme) && readme.includes("x-request-id"),
    "README must document logs + x-request-id"
  );
  assert(
    /Vercel/i.test(readme),
    "README must mention Vercel"
  );
  assert(
    readme.includes("LOG_LEVEL"),
    "README must mention LOG_LEVEL"
  );
  assert(
    !/5-minute demo slides/i.test(readme) && !/### Slide 1/i.test(readme),
    "README must not include demo slides section"
  );

  const env = read(".env.example");
  assert(env.includes("LOG_LEVEL"), ".env.example must document LOG_LEVEL");

  const f01 = featureDoc(root, "F01");
  assert(
    /Phase G — Infrastructure ✅/.test(f01),
    "F01 Phase G should be marked done"
  );

  console.log("ok  Phase G README / env contracts");
  console.log("\nF01-G smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF01-G smoke FAILED:", error.message);
  process.exit(1);
}
