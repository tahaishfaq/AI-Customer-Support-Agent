/**
 * F04-F — design token map contracts.
 * Run: npm run test:f04f
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
  assert(/Phase F — Scaling ✅/.test(f04), "F04-F marked done");
  assert(
    /Token map/i.test(f04) &&
      /--color-primary/.test(f04) &&
      /--wc-\*/.test(f04),
    "F04-F must document token map including --wc-*"
  );

  const css = read("app/globals.css");
  assert(
    /--color-primary:\s*#(0d7377|0b5f58|0f766e)/i.test(css),
    "teal primary (#0d7377 family)"
  );
  assert(/--text-sm:/.test(css) && /--font-display:/.test(css), "type tokens");

  const theme = read("lib/customization/theme.js");
  assert(/--wc-primary/.test(theme) && /widgetStyleVars/.test(theme), "widget tokens");

  console.log("ok  F04-F token map");
  console.log("\nF04-F smoke passed");
}

main();
