import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const dialog = read("components/customization/HttpToolDialog.jsx");
const form = read("components/customization/ActionsForm.jsx");
const api = read("lib/api/actions.js");
const config = read("lib/actions/action-config.js");

const checks = [
  ["guided response tab", dialog.includes('value="response"')],
  ["safe projection field input", dialog.includes("responseProjectionJsonText")],
  ["typed output input", dialog.includes("outputSchemaJsonText")],
  ["projection reaches save payload", form.includes("responseProjectionJson")],
  ["templates remain available", config.includes("ACTION_TEMPLATES")],
  ["publish API", api.includes("publishAgentActionRevision")],
  ["draft API", api.includes("createAgentActionDraftRevision")],
  ["connected systems API", fs.existsSync("lib/api/connections.js")],
  ["connection selection", dialog.includes("form.connectionId")],
  ["starter templates", form.includes("Starter actions") && form.includes("ACTION_TEMPLATES.slice")],
  ["published status visible", form.includes("publishedRevisionId")],
  ["no browser secret handling", !dialog.includes("plaintext") && !form.includes("process.env")],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error("Phase 6 checks failed:", failures.join(", "));
  process.exit(1);
}

console.log(`Phase 6 checks passed (${checks.length})`);
