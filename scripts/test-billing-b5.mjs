import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

async function main() {
  const migration = read(
    "prisma/migrations/20260901220000_b01_rename_free_basic/migration.sql"
  );
  assert(migration.includes("Basic"), "rename migration must set Basic name");

  const constants = read("lib/billing/constants.js");
  assert(constants.includes('name: "Basic"'), "seed must use Basic display name");

  const labels = read("lib/billing/plan-labels.js");
  assert(labels.includes('BASIC_PLAN_NAME = "Basic"'), "plan labels helper required");

  const picker = read("components/billing/BillingPlanPicker.jsx");
  assert(picker.includes("max-w-[68rem]"), "plans grid must be centered with max width");
  assert(picker.includes("BASIC_PLAN_NAME"), "plan picker must use Basic label");
  assert(!picker.includes("Start free"), "plan picker must not say Start free");

  const plansPage = read("app/(billing)/billing/plans/page.jsx");
  assert(plansPage.includes("text-center"), "plans page header must be centered");

  assert(
    fs.existsSync(path.join(root, "scripts/billing-expire-pending.mjs")),
    "B5 expire-pending script required"
  );

  const subscription = read("lib/billing/subscription.service.js");
  assert(
    subscription.includes("expireStalePendingCheckouts"),
    "subscription service must expire stale pending checkouts"
  );

  const pkg = JSON.parse(read("package.json"));
  assert(pkg.scripts["billing:expire-pending"], "package.json must expose expire script");

  console.log("B5 static checks passed");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
