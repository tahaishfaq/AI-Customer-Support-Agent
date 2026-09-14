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
    "prisma/migrations/20260901210000_b01_billing_b4_pending_plan/migration.sql"
  );
  assert(migration.includes("pendingPlanId"), "B4 migration must add pendingPlanId");

  const schema = read("prisma/schema.prisma");
  assert(schema.includes("pendingPlanId"), "schema must define pendingPlanId");

  const checkout = read("lib/billing/checkout.service.js");
  assert(
    checkout.includes("pendingPlanId: plan.id"),
    "checkout must set pendingPlanId for active plan changes"
  );
  assert(
    checkout.includes("plan_coming_soon"),
    "checkout must block coming-soon plans"
  );

  const webhook = read("lib/billing/webhook.service.js");
  const activatePaid = read("lib/billing/activate-paid-subscription.js");
  assert(
    webhook.includes("activatePaidSubscription") ||
      activatePaid.includes("subscription.pendingPlanId"),
    "webhook must apply pending plan on activation"
  );

  const subscription = read("lib/billing/subscription.service.js");
  assert(
    subscription.includes("expireStalePendingCheckouts"),
    "subscription service must expire stale pending checkouts"
  );
  assert(
    subscription.includes("BILLING_DOWNGRADE_SCHEDULED") ||
      subscription.includes("scheduledDowngrade"),
    "paid→Basic must schedule period-end downgrade (not immediate entitlement drop)"
  );
  assert(
    subscription.includes("applyDuePeriodEndTransitions"),
    "period-end job must apply scheduled downgrades without webhook"
  );
  assert(
    subscription.includes("Cancellation is already scheduled"),
    "cancel must reject double cancel"
  );
  assert(
    subscription.includes("subscription.cancel(token)"),
    "paid cancel/downgrade must call SafePay cancel when token present"
  );
  assert(
    subscription.includes("Keep paid planId") ||
      subscription.includes("keep paid entitlements") ||
      subscription.includes("Period-end downgrade"),
    "paid→Basic comment/path must keep paid entitlements until period end"
  );

  assert(
    fs.existsSync(path.join(root, "app/(app)/settings/billing/page.jsx")),
    "settings billing page required"
  );
  assert(
    fs.existsSync(path.join(root, "app/api/billing/cancel/route.js")),
    "cancel API required"
  );

  const settings = read("components/billing/BillingSettings.jsx");
  assert(settings.includes("pendingPlan"), "billing settings should show pending checkout");

  const topbar = read("components/layout/AppTopbar.jsx");
  assert(
    !topbar.includes("ConversationQuotaTopbar"),
    "navbar must not render conversation quota"
  );

  console.log("B4 static checks passed");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
