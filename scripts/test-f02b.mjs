/**
 * F02 Phase B smoke — baselines tooling + hot-path docs + duration headers.
 * Run: npm run test:f02b
 * Live numbers: npm run bench:f02b (dev server + optional admin env)
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
    /Phase B — Design & functionality ✅/.test(f02),
    "F02 Phase B should be marked done"
  );
  assert(
    f02.includes("Hot path — chat") &&
      f02.includes("Hot path — analytics") &&
      f02.includes("Hot path — admin overview"),
    "F02-B must document chat / analytics / admin overview hot paths"
  );
  assert(
    /Baseline checklist/i.test(f02) && f02.includes("x-hapy-duration-ms"),
    "F02-B must have baseline checklist + duration header note"
  );
  assert(
    f02.includes("scripts/bench-f02b.mjs") || f02.includes("bench:f02b"),
    "F02-B Delivered must reference bench script"
  );
  console.log("ok  F02-B doc contracts");

  assert(
    fs.existsSync(path.join(root, "scripts/bench-f02b.mjs")),
    "missing scripts/bench-f02b.mjs"
  );
  assert(
    fs.existsSync(path.join(root, "lib/observability/duration.js")),
    "missing lib/observability/duration.js"
  );

  const duration = read("lib/observability/duration.js");
  assert(
    duration.includes("x-hapy-duration-ms"),
    "duration helper must set x-hapy-duration-ms"
  );

  const productDash = read("app/api/analytics/dashboard/route.js");
  const adminDash = read("app/api/admin/analytics/dashboard/route.js");
  const overview = read("app/api/admin/overview/route.js");
  const studio = read("app/api/agents/[id]/chat/route.js");
  for (const [name, src] of [
    ["product analytics", productDash],
    ["admin analytics", adminDash],
    ["admin overview", overview],
    ["studio chat", studio],
  ]) {
    assert(
      src.includes("durationHeaders"),
      `${name} route must emit durationHeaders`
    );
  }
  console.log("ok  duration headers wired");

  console.log("\nF02-B smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF02-B smoke FAILED:", error.message);
  process.exit(1);
}
