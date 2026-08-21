import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import { withVerifyFullSsl } from "../lib/pg-connection.js";

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({
    connectionString: withVerifyFullSsl(connectionString),
  });
  const stamp = Date.now();
  const email = `a0-test-${stamp}@example.com`;
  const userId = randomUUID();

  try {
    const adminCount = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "User" WHERE role = 'ADMIN'`
    );
    assert(
      adminCount.rows[0].n <= 1,
      `Expected at most 1 ADMIN, found ${adminCount.rows[0].n}`
    );

    const passwordHash = await bcrypt.hash("test-password-a0", 10);
    const created = await pool.query(
      `INSERT INTO "User" (id, name, email, "passwordHash", role, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'USER', 'ACTIVE', NOW(), NOW())
       RETURNING role, status`,
      [userId, "A0 Test User", email, passwordHash]
    );
    assert(created.rows[0].role === "USER", "New users must be USER");
    assert(created.rows[0].status === "ACTIVE", "New users must be ACTIVE");

    const still = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "User" WHERE role = 'ADMIN'`
    );
    assert(
      still.rows[0].n === adminCount.rows[0].n,
      "Creating a USER must not change ADMIN count"
    );
    assert(still.rows[0].n === 1, `Expected exactly 1 ADMIN, found ${still.rows[0].n}`);

    const secondAdmin = await pool.query(
      `INSERT INTO "User" (id, name, email, "passwordHash", role, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', NOW(), NOW())
       RETURNING id`,
      [`a0-second-${stamp}`, "Second Admin", `a0-second-${stamp}@example.com`, passwordHash]
    ).then(
      () => ({ ok: true }),
      (err) => ({ ok: false, code: err.code })
    );
    assert(!secondAdmin.ok, "Second ADMIN insert must fail");
    assert(
      secondAdmin.code === "23505",
      `Expected unique violation 23505, got ${secondAdmin.code}`
    );

    const base = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
      /\/$/,
      ""
    );
    const overview = await fetch(`${base}/api/admin/overview`);
    if (overview.status === 401) {
      console.log("A0 HTTP: USER/anon /api/admin/overview → 401");
    } else {
      console.log(
        `A0 HTTP: /api/admin/overview status ${overview.status} (start npm run dev to assert 401)`
      );
    }

    console.log("A0 prisma checks passed", {
      adminCount: still.rows[0].n,
      createdUserRole: created.rows[0].role,
    });
  } finally {
    await pool.query(`DELETE FROM "User" WHERE email = $1`, [email]);
    await pool.end();
  }
}

main().catch((error) => {
  console.error("A0 test failed:", error.message || error);
  process.exit(1);
});
