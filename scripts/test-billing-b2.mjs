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
    "prisma/migrations/20260901200000_b01_billing_b2_events/migration.sql"
  );
  assert(migration.includes("BillingEvent"), "B2 migration must create BillingEvent");

  const schema = read("prisma/schema.prisma");
  assert(schema.includes("model BillingEvent"), "schema must define BillingEvent");

  for (const file of [
    "lib/billing/safepay-client.js",
    "lib/billing/checkout.service.js",
    "lib/billing/webhook.service.js",
    "lib/billing/reconcile.service.js",
    "lib/billing/activate-paid-subscription.js",
    "app/api/billing/checkout/route.js",
    "app/api/billing/reconcile/route.js",
    "app/api/webhooks/safepay/route.js",
    "app/(billing)/billing/success/page.jsx",
    "app/(billing)/billing/canceled/page.jsx",
  ]) {
    assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
  }

  const picker = read("components/billing/BillingPlanPicker.jsx");
  assert(picker.includes("startPaidCheckout"), "plan picker must call checkout");

  const successClient = read("components/billing/BillingSuccessClient.jsx");
  assert(
    successClient.includes("reconcileBillingCheckout"),
    "success page must reconcile checkout after SafePay redirect"
  );

  const pkg = JSON.parse(read("package.json"));
  assert(
    pkg.dependencies["@sfpy/node-sdk"],
    "package.json must include @sfpy/node-sdk"
  );

  console.log("B2 static checks passed");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
