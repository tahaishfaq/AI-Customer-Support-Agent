import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { Pool } from "pg";
import { withVerifyFullSsl } from "../lib/pg-connection.js";

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
    "prisma/migrations/20260901140000_b01_billing_b1_subscription/migration.sql"
  );
  assert(migration.includes("Subscription"), "B1 migration must create Subscription");
  assert(
    migration.includes("Subscription_user_open_key"),
    "partial unique index required"
  );
  assert(migration.includes("planType") && migration.includes("FREE"), "grandfather uses Free plan");

  const appLayout = read("app/(app)/layout.jsx");
  assert(
    appLayout.includes("/billing/plans"),
    "app layout must redirect to billing plans when locked"
  );
  assert(
    appLayout.includes("/billing/onboarding"),
    "app layout must redirect to onboarding after plan is chosen"
  );
  assert(
    appLayout.includes('redirect("/login")'),
    "app layout must require session"
  );

  const proxy = read("proxy.js");
  assert(proxy.includes("/billing"), "proxy must include billing routes");

  const subscribeRoute = read("app/api/billing/subscribe/route.js");
  assert(subscribeRoute.includes("activateFreePlan"), "subscribe route must activate free");

  const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );

  const statusAnon = await fetch(`${base}/api/billing/status`);
  if (statusAnon.status === 401) {
    console.log("B1 HTTP: anon /api/billing/status → 401");
  } else {
    console.log(`B1 HTTP: anon status ${statusAnon.status}`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    const pool = new Pool({
      connectionString: withVerifyFullSsl(connectionString),
    });
    try {
      const table = await pool.query(
        `SELECT to_regclass('"Subscription"') AS reg`
      );
      if (table.rows[0]?.reg) {
        const users = await pool.query(
          `SELECT COUNT(*)::int AS n FROM "User" WHERE role = 'USER'`
        );
        const subs = await pool.query(
          `SELECT COUNT(*)::int AS n FROM "Subscription" WHERE status = 'ACTIVE'`
        );
        console.log(
          `B1 DB: ${subs.rows[0].n} ACTIVE subscription(s) for ${users.rows[0].n} USER account(s)`
        );
      } else {
        console.log("B1 DB: run prisma migrate deploy for Subscription table");
      }
    } finally {
      await pool.end();
    }
  }

  console.log("B1 billing gate checks passed");
}

main().catch((error) => {
  console.error("B1 billing test failed:", error.message || error);
  process.exit(1);
});
