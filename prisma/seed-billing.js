import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { withVerifyFullSsl } from "../lib/pg-connection.js";
import { DEFAULT_BILLING_PLANS } from "../lib/billing/constants.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: withVerifyFullSsl(connectionString),
  });

  try {
    for (const seed of DEFAULT_BILLING_PLANS) {
      const existing = await pool.query(
        `SELECT id FROM "BillingPlan" WHERE "planType" = $1`,
        [seed.planType]
      );

      if (existing.rowCount) {
        await pool.query(
          `UPDATE "BillingPlan"
           SET slug = $2,
               name = $3,
               description = $4,
               "isPopular" = $5,
               "priceMinor" = $6,
               currency = $7,
               interval = $8::"BillingInterval",
               "maxWorkspaces" = $9,
               "maxAgentsPerWorkspace" = $10,
               "maxConversationsPerMonth" = $11,
               "featuresJson" = $12::jsonb,
               "sortOrder" = $13,
               "updatedAt" = NOW()
           WHERE "planType" = $1`,
          [
            seed.planType,
            seed.slug,
            seed.name,
            seed.description,
            seed.isPopular,
            seed.priceMinor,
            seed.currency,
            seed.interval,
            seed.maxWorkspaces,
            seed.maxAgentsPerWorkspace,
            seed.maxConversationsPerMonth,
            JSON.stringify(seed.featuresJson),
            seed.sortOrder,
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO "BillingPlan" (
             id, slug, name, description, "planType", "isPopular", "priceMinor",
             currency, interval, "safepayPlanId", "maxWorkspaces", "maxAgentsPerWorkspace",
             "maxConversationsPerMonth", "featuresJson", "sortOrder", "isActive", "isDefault", "createdAt", "updatedAt"
           ) VALUES (
             $1, $2, $3, $4, $5::"BillingPlanType", $6, $7,
             $8, $9::"BillingInterval", $10, $11, $12, $13,
             $14::jsonb, $15, $16, $17, NOW(), NOW()
           )`,
          [
            randomUUID(),
            seed.slug,
            seed.name,
            seed.description,
            seed.planType,
            seed.isPopular,
            seed.priceMinor,
            seed.currency,
            seed.interval,
            seed.safepayPlanId,
            seed.maxWorkspaces,
            seed.maxAgentsPerWorkspace,
            seed.maxConversationsPerMonth,
            JSON.stringify(seed.featuresJson),
            seed.sortOrder,
            seed.isActive,
            seed.isDefault,
          ]
        );
      }
    }

    await pool.query(
      `UPDATE "BillingPlan" SET "isDefault" = false WHERE "planType" <> 'FREE'`
    );
    await pool.query(
      `UPDATE "BillingPlan" SET "isDefault" = true WHERE "planType" = 'FREE'`
    );

    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM "BillingPlan"`);
    console.log(`Billing seed complete — ${count.rows[0].n} plan(s) in catalog`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
