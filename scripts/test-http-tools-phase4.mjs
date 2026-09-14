import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260909100000_action_revisions/migration.sql"
);
const revisions = read("lib/services/action-revision.service.js");
const actions = read("lib/services/action.service.js");
const invoke = read("lib/actions/invoke-tool.js");
const confirmations = read("lib/services/confirmation.service.js");
const registry = read("lib/capabilities/registry.js");
const backfill = read("scripts/backfill-action-revisions.mjs");

const checks = [
  ["revision lifecycle enum", schema.includes("enum ActionRevisionState")],
  ["immutable revision model", schema.includes("model ActionRevision")],
  ["published and draft pointers", schema.includes("publishedRevisionId") && schema.includes("currentDraftRevisionId")],
  ["historical tool-run pin", schema.includes("actionRevisionId String?")],
  ["additive migration", migration.includes("CREATE TABLE \"ActionRevision\"") && migration.includes("ADD COLUMN \"actionRevisionId\"")],
  ["configuration hash", revisions.includes("actionConfigurationHash") && revisions.includes("sha256")],
  ["publish transition", revisions.includes('state: "PUBLISHED"') && revisions.includes('state: "RETIRED"')],
  ["rollback endpoint", fs.existsSync("app/api/agents/[id]/actions/[actionId]/revisions/[revisionId]/rollback/route.js")],
  ["published edit protection", actions.includes("ACTION_REVISION_IMMUTABLE")],
  ["runtime materialization", invoke.includes("materializePublishedAction") && registry.includes("materializePublishedAction")],
  ["stale revision fail-closed", invoke.includes("ACTION_REVISION_CHANGED")],
  ["confirmation revision binding", confirmations.includes("actionRevisionId")],
  ["repeatable legacy backfill", backfill.includes("where: { revisions: { none: {} } }") && backfill.includes("VALIDATED")],
  ["no plaintext secret snapshot", !revisions.includes("secret") && !revisions.includes("apiKey")],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error("Phase 4 checks failed:", failures.join(", "));
  process.exit(1);
}

console.log(`Phase 4 checks passed (${checks.length})`);
