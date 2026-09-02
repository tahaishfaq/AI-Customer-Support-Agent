/**
 * F04-G — no new design-system package; Storybook deferred.
 * Run: npm run test:f04g
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
  assert(/Phase G — Infrastructure ✅/.test(f04), "F04-G marked done");
  assert(
    /No.*design system package|keep Tailwind/i.test(f04) &&
      /Storybook/i.test(f04) &&
      /Deferred/i.test(f04),
    "F04-G must record no-new-DS + Storybook deferred"
  );

  const pkg = JSON.parse(read("package.json"));
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  for (const name of Object.keys(deps)) {
    assert(
      !name.startsWith("@storybook/") && name !== "storybook",
      `unexpected Storybook dep: ${name}`
    );
  }

  assert(fs.existsSync(path.join(root, "app/globals.css")), "globals.css");
  assert(
    Boolean(deps.tailwindcss || deps["@tailwindcss/postcss"]),
    "Tailwind still present"
  );

  console.log("ok  F04-G infra decisions");
  console.log("\nF04-G smoke passed");
}

main();
