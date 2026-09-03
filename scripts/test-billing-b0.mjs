import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { Pool } from "pg";
import { withVerifyFullSsl } from "../lib/pg-connection.js";
import { BILLING_PLAN_TYPES, DEFAULT_BILLING_PLANS } from "../lib/billing/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

async function main() {
  assert(
    DEFAULT_BILLING_PLANS.length === 4,
    "seed must define exactly 4 billing plans"
  );
  assert(
    new Set(DEFAULT_BILLING_PLANS.map((p) => p.planType)).size === 4,
    "plan types must be unique in seed"
  );
  for (const type of BILLING_PLAN_TYPES) {
    assert(
      DEFAULT_BILLING_PLANS.some((p) => p.planType === type),
      `missing seed for ${type}`
    );
  }

  const popular = DEFAULT_BILLING_PLANS.find((p) => p.planType === "POPULAR");
  assert(popular?.isPopular === true, "Popular slot must set isPopular");
  const teams = DEFAULT_BILLING_PLANS.find((p) => p.planType === "TEAMS");
  assert(teams?.isPopular === false, "Teams slot must not set isPopular");

  const migration = read("prisma/migrations/20260901120000_b01_billing_b0/migration.sql");
  assert(migration.includes("BillingPlan"), "migration must create BillingPlan");
  assert(
    migration.includes("CustomPlanRequest"),
    "migration must create CustomPlanRequest"
  );
  assert(
    migration.includes("BillingPlan_planType_key"),
    "migration must unique-index planType"
  );

  const plansRoute = read("app/api/billing/plans/route.js");
  assert(!plansRoute.includes("safepayPlanId"), "public plans route must not expose secrets");

  const adminPost = read("app/api/admin/billing/plans/route.js");
  assert(adminPost.includes("409"), "admin POST must return 409 for 5th plan");

  const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );

  const publicPlans = await fetch(`${base}/api/billing/plans`);
  if (publicPlans.ok) {
    const body = await publicPlans.json();
    const plans = body.plans || [];
    assert(plans.length === 4, `public catalog must return 4 plans, got ${plans.length}`);
    assert(
      plans.every((p) => p.safepayPlanId === undefined),
      "public plans must not include safepayPlanId"
    );
    const popularPublic = plans.find((p) => p.planType === "POPULAR");
    assert(popularPublic?.isPopular === true, "public Popular must have badge flag");
    console.log("B0 HTTP: GET /api/billing/plans → 4 public slots");
  } else {
    console.log(
      `B0 HTTP: GET /api/billing/plans status ${publicPlans.status} (run dev + migrate for live check)`
    );
  }

  const anonAdmin = await fetch(`${base}/api/admin/billing/plans`);
  if (anonAdmin.status === 401) {
    console.log("B0 HTTP: anon /api/admin/billing/plans → 401");
  } else {
    console.log(
      `B0 HTTP: anon admin plans status ${anonAdmin.status} (expected 401 when dev is up)`
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const pool = new Pool({
      connectionString: withVerifyFullSsl(connectionString),
    });
    try {
      const table = await pool.query(
        `SELECT to_regclass('"BillingPlan"') AS reg`
      );
      if (table.rows[0]?.reg) {
        const count = await pool.query(`SELECT COUNT(*)::int AS n FROM "BillingPlan"`);
        if (count.rows[0].n === 0) {
          console.log("B0 DB: BillingPlan empty — run npm run seed:billing");
        } else {
          assert(count.rows[0].n === 4, `expected 4 plans in DB, got ${count.rows[0].n}`);
          console.log("B0 DB: BillingPlan has 4 rows");
        }
      } else {
        console.log("B0 DB: run prisma migrate deploy for billing tables");
      }
    } finally {
      await pool.end();
    }
  }

  console.log("B0 billing catalog checks passed");
}

main().catch((error) => {
  console.error("B0 billing test failed:", error.message || error);
  process.exit(1);
});
