/**
 * F13-T2 smoke — HTTP tab polish: cards + Add HTTP tool dialog tabs.
 * Run: npm run test:f13t2
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function main() {
  assert(exists("components/customization/HttpToolDialog.jsx"), "HttpToolDialog");
  const dialog = read("components/customization/HttpToolDialog.jsx");
  for (const tab of ["params", "body", "auth", "headers"]) {
    assert(
      new RegExp(`value="${tab}"`).test(dialog),
      `dialog tab ${tab}`
    );
  }
  assert(/>Inputs</.test(dialog) || /FieldLabel>Inputs</.test(dialog), "Inputs section");
  assert(/Timeout \(ms\)/.test(dialog), "Timeout field");
  assert(/Requires confirmation/.test(dialog), "confirmation flag");
  assert(/END_USER_TOKEN|Requires customer identity|Identity mode/.test(dialog), "identity flag");
  assert(/Risk level/.test(dialog), "risk level");
  assert(/URL template/.test(dialog), "URL / frozen-host surface");
  assert(/SSRF/.test(dialog), "SSRF called out");
  assert(/Add parameter/.test(dialog), "Add parameter");
  assert(/Add input/.test(dialog), "Add input");
  assert(/onDelete/.test(dialog), "Delete in dialog");

  const form = read("components/customization/ActionsForm.jsx");
  assert(/Add HTTP tool/.test(form), "Add HTTP tool CTA");
  assert(/HttpToolDialog/.test(form), "uses HttpToolDialog");
  assert(/inputSchemaJsonText/.test(form), "Inputs schema text field");
  assert(/closeEditor/.test(form), "closeEditor");
  assert(/grid gap-3 sm:grid-cols-2/.test(form), "tool card grid");
  assert(
    /action\.method === "POST"/.test(form) || /action\.method \|\| "GET"/.test(form),
    "method badge"
  );
  assert(!/FormSection title=\{editingId/.test(form), "no inline edit FormSection");
  assert(!/Edit as developer/.test(form), "no Advanced collapsible");

  const plan = read("docs/features/F13_TOOLS_HUB.md");
  assert(/Phase T2/.test(plan) && /✅/.test(plan), "F13 plan marks T2");

  console.log("ok  HttpToolDialog Params·Body·Auth·Headers + Inputs·Timeout");
  console.log("ok  ActionsForm HTTP cards + dialog");
  console.log("\nF13-T2 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF13-T2 smoke FAILED:", error.message);
  process.exit(1);
}
