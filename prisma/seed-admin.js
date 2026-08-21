import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import { withVerifyFullSsl } from "../lib/pg-connection.js";

/**
 * Upsert the single platform ADMIN from env.
 * Never creates a second ADMIN.
 */
async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Hapy Admin";

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in .env"
    );
  }
  if (password.length < 10) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 10 characters");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: withVerifyFullSsl(connectionString),
  });

  try {
    const admins = await pool.query(
      `SELECT id, email FROM "User" WHERE role = 'ADMIN'`
    );
    if (admins.rowCount > 1) {
      throw new Error(
        `Found ${admins.rowCount} ADMIN users. Fix the database before seeding.`
      );
    }

    const other = admins.rows.find((row) => row.email !== email);
    if (other) {
      throw new Error(
        `An ADMIN already exists (${other.email}). Cannot seed a second admin.`
      );
    }

    const existing = await pool.query(
      `SELECT id, name FROM "User" WHERE email = $1`,
      [email]
    );
    const passwordHash = await bcrypt.hash(password, 10);

    if (existing.rowCount) {
      await pool.query(
        `UPDATE "User"
         SET "passwordHash" = $1, role = 'ADMIN', status = 'ACTIVE', "googleId" = NULL, name = COALESCE(NULLIF(name, ''), $2), "updatedAt" = NOW()
         WHERE id = $3`,
        [passwordHash, name, existing.rows[0].id]
      );
      console.log(`Updated ADMIN ${email}`);
    } else {
      const userId = randomUUID();
      await pool.query(
        `INSERT INTO "User" (id, name, email, "passwordHash", role, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', NOW(), NOW())`,
        [userId, name, email, passwordHash]
      );
      await pool.query(
        `INSERT INTO "Workspace" (id, "userId", name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [randomUUID(), userId, "Default Workspace"]
      );
      console.log(`Created ADMIN ${email}`);
    }

    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "User" WHERE role = 'ADMIN'`
    );
    if (count.rows[0].n !== 1) {
      throw new Error(`Expected exactly 1 ADMIN, found ${count.rows[0].n}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
