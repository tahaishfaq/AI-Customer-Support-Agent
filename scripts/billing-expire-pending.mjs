import "dotenv/config";
import { Pool } from "pg";
import { withVerifyFullSsl } from "../lib/pg-connection.js";

const PENDING_CHECKOUT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function expireStalePendingCheckouts(pool, { maxAgeMs = PENDING_CHECKOUT_MAX_AGE_MS } = {}) {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const stalePurePending = await pool.query(
    `UPDATE "Subscription"
     SET status = 'EXPIRED'
     WHERE status = 'PENDING'
       AND "pendingPlanId" IS NULL
       AND "createdAt" < $1`,
    [cutoff]
  );

  const clearedPendingUpgrades = await pool.query(
    `UPDATE "Subscription"
     SET "pendingPlanId" = NULL,
         "checkoutReference" = NULL
     WHERE status IN ('ACTIVE', 'PAST_DUE')
       AND "pendingPlanId" IS NOT NULL
       AND "updatedAt" < $1`,
    [cutoff]
  );

  return {
    expiredPending: stalePurePending.rowCount,
    clearedPendingUpgrades: clearedPendingUpgrades.rowCount,
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: withVerifyFullSsl(connectionString),
  });

  try {
    const result = await expireStalePendingCheckouts(pool);
    console.log(
      JSON.stringify(
        {
          ok: true,
          expiredPending: result.expiredPending,
          clearedPendingUpgrades: result.clearedPendingUpgrades,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
