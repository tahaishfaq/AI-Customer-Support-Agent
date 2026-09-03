/**
 * Audit + delete all DB rows tied to user emails (user row may already be gone).
 * Usage:
 *   node scripts/cleanup-users-by-email.mjs email1@x.com email2@y.com
 *   node scripts/cleanup-users-by-email.mjs --apply email1@x.com
 */
import "dotenv/config";
import { Pool } from "pg";
import { withVerifyFullSsl } from "../lib/pg-connection.js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const emails = args
  .filter((a) => !a.startsWith("--"))
  .map((e) => e.trim().toLowerCase())
  .filter((e) => e.includes("@"));

if (!emails.length) {
  console.error(
    "Usage: node scripts/cleanup-users-by-email.mjs [--apply] email@example.com ..."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: withVerifyFullSsl(process.env.DATABASE_URL),
});

async function q(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function auditEmail(email) {
  console.log(`\n=== ${email} ===`);

  const users = await q(
    `SELECT id, name, email, "googleId", role, status, "createdAt"
     FROM "User" WHERE lower(email) = $1`,
    [email]
  );
  console.log("User rows:", users.length ? users : "(none)");

  const userIds = users.map((u) => u.id);

  const customByEmail = await q(
    `SELECT id, "userId", "contactEmail", status, "createdAt"
     FROM "CustomPlanRequest" WHERE lower("contactEmail") = $1`,
    [email]
  );
  if (customByEmail.length) {
    console.log("CustomPlanRequest by contactEmail:", customByEmail);
  }

  const tokens = await q(
    `SELECT identifier, token, expires FROM "VerificationToken" WHERE lower(identifier) = $1`,
    [email]
  );
  if (tokens.length) console.log("VerificationToken:", tokens.length);

  if (!userIds.length) {
    console.log("No User row — email-scoped tables checked above.");
    return { email, userIds: [], customByEmail, tokens };
  }

  for (const userId of userIds) {
    const counts = await q(
      `
      SELECT 'Account' AS tbl, COUNT(*)::int AS n FROM "Account" WHERE "userId" = $1
      UNION ALL SELECT 'Session', COUNT(*)::int FROM "Session" WHERE "userId" = $1
      UNION ALL SELECT 'Workspace', COUNT(*)::int FROM "Workspace" WHERE "userId" = $1
      UNION ALL SELECT 'Agent', COUNT(*)::int FROM "Agent" WHERE "userId" = $1
      UNION ALL SELECT 'Subscription', COUNT(*)::int FROM "Subscription" WHERE "userId" = $1
      UNION ALL SELECT 'UserOnboarding', COUNT(*)::int FROM "UserOnboarding" WHERE "userId" = $1
      UNION ALL SELECT 'CustomPlanRequest', COUNT(*)::int FROM "CustomPlanRequest" WHERE "userId" = $1
      UNION ALL SELECT 'RestoreRequest', COUNT(*)::int FROM "RestoreRequest" WHERE "userId" = $1
      UNION ALL SELECT 'AuditEvent', COUNT(*)::int FROM "AuditEvent" WHERE "adminId" = $1
      UNION ALL SELECT 'AssignedConversations', COUNT(*)::int FROM "Conversation" WHERE "assignedUserId" = $1
      `,
      [userId]
    );
    console.log(`Related counts for userId ${userId}:`);
    for (const row of counts) {
      if (row.n > 0) console.log(`  ${row.tbl}: ${row.n}`);
    }

    const agents = await q(`SELECT id, name FROM "Agent" WHERE "userId" = $1`, [
      userId,
    ]);
    if (agents.length) {
      const agentIds = agents.map((a) => a.id);
      const conv = await q(
        `SELECT COUNT(*)::int AS n FROM "Conversation" WHERE "agentId" = ANY($1::text[])`,
        [agentIds]
      );
      console.log(`  Conversations (via agents): ${conv[0]?.n ?? 0}`);
    }
  }

  return { email, userIds, customByEmail, tokens };
}

async function purgeOrphans() {
  const tables = [
    ["Subscription", "userId"],
    ["UserOnboarding", "userId"],
    ["Account", "userId"],
    ["Session", "userId"],
    ["Workspace", "userId"],
    ["Agent", "userId"],
    ["RestoreRequest", "userId"],
    ["CustomPlanRequest", "userId"],
  ];

  for (const [table, col] of tables) {
    const res = await pool.query(
      `DELETE FROM "${table}" t
       WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."${col}")`
    );
    if (res.rowCount > 0) {
      console.log(`Purged ${res.rowCount} orphan row(s) from ${table}`);
    }
  }

  const assigned = await pool.query(
    `UPDATE "Conversation" SET "assignedUserId" = NULL
     WHERE "assignedUserId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "assignedUserId")`
  );
  if (assigned.rowCount > 0) {
    console.log(
      `Cleared ${assigned.rowCount} orphan assignedUserId on Conversation`
    );
  }
}

async function cleanup(audit) {
  const { email, userIds, customByEmail, tokens } = audit;

  if (tokens.length) {
    await pool.query(
      `DELETE FROM "VerificationToken" WHERE lower(identifier) = $1`,
      [email]
    );
    console.log(`Deleted VerificationToken for ${email}`);
  }

  if (customByEmail.length) {
    await pool.query(
      `DELETE FROM "CustomPlanRequest" WHERE lower("contactEmail") = $1`,
      [email]
    );
    console.log(`Deleted CustomPlanRequest rows for contactEmail ${email}`);
  }

  for (const userId of userIds) {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    console.log(`Deleted User ${userId} (cascade removes children)`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  console.log(
    APPLY ? "MODE: APPLY (destructive)" : "MODE: audit only (pass --apply to delete)"
  );

  const audits = [];
  for (const email of emails) {
    audits.push(await auditEmail(email));
  }

  if (!APPLY) {
    console.log("\nDB already clean if all sections show (none).");
    console.log("Re-run with --apply to delete any remaining rows + purge orphans.");
    return;
  }

  console.log("\n--- Deleting ---");
  for (const audit of audits) {
    await cleanup(audit);
  }
  await purgeOrphans();

  console.log("\n--- Post-cleanup verify ---");
  for (const email of emails) {
    await auditEmail(email);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
