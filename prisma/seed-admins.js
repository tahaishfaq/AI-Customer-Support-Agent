import "dotenv/config";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import { withVerifyFullSsl } from "../lib/pg-connection.js";
import { slugify } from "../lib/utils/slugify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_FILE = join(__dirname, "admins.local.json");
const EXAMPLE_FILE = join(__dirname, "admins.local.example.json");
const MAX_ADMINS = 3;

function loadAdmins() {
  if (!existsSync(LOCAL_FILE)) {
    throw new Error(
      `Missing ${LOCAL_FILE}. Copy prisma/admins.local.example.json → prisma/admins.local.json, fill 1–3 admins, then re-run. Never commit the local file.`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(LOCAL_FILE, "utf8"));
  } catch {
    throw new Error("prisma/admins.local.json is not valid JSON");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("admins.local.json must be a non-empty array");
  }
  if (parsed.length > MAX_ADMINS) {
    throw new Error(`Seed at most ${MAX_ADMINS} admins`);
  }

  const admins = parsed.map((row, index) => {
    const email = String(row?.email || "")
      .trim()
      .toLowerCase();
    const password = String(row?.password || "");
    const name = String(row?.name || "").trim() || `Aide Admin ${index + 1}`;
    if (!email || !email.includes("@")) {
      throw new Error(`Admin ${index + 1} needs a valid email`);
    }
    if (password.length < 10) {
      throw new Error(`Admin ${email}: password must be at least 10 characters`);
    }
    return { email, password, name };
  });

  const emails = new Set(admins.map((a) => a.email));
  if (emails.size !== admins.length) {
    throw new Error("Duplicate admin emails in admins.local.json");
  }

  return admins;
}

async function upsertAdmin(pool, { email, password, name }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [
    email,
  ]);

  if (existing.rowCount) {
    await pool.query(
      `UPDATE "User"
       SET "passwordHash" = $1, role = 'ADMIN', status = 'ACTIVE', "googleId" = NULL,
           name = COALESCE(NULLIF(name, ''), $2), "updatedAt" = NOW()
       WHERE id = $3`,
      [passwordHash, name, existing.rows[0].id]
    );
    console.log(`Updated ADMIN ${email}`);
    return existing.rows[0].id;
  }

  const userId = randomUUID();
  await pool.query(
    `INSERT INTO "User" (id, name, email, "passwordHash", role, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', NOW(), NOW())`,
    [userId, name, email, passwordHash]
  );

  const workspaceId = randomUUID();
  const workspaceName = name;
  try {
    await pool.query(
      `INSERT INTO "Workspace" (id, "userId", name, slug, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [workspaceId, userId, workspaceName, slugify(workspaceName)]
    );
  } catch (error) {
    if (!String(error.message || "").includes("slug")) throw error;
    await pool.query(
      `INSERT INTO "Workspace" (id, "userId", name, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [workspaceId, userId, workspaceName]
    );
  }
  console.log(`Created ADMIN ${email}`);
  return userId;
}

async function main() {
  const admins = loadAdmins();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({
    connectionString: withVerifyFullSsl(connectionString),
  });

  try {
    const emails = [];
    for (const admin of admins) {
      await upsertAdmin(pool, admin);
      emails.push(admin.email);
    }

    const reserved = emails.join(",");
    await pool.query(
      `INSERT INTO "PlatformSettings" (
         id, "signupsEnabled", "maintenanceMode", "globalEmbedKill",
         "maxWorkspacesPerUser", "maxAgentsPerWorkspace", "reservedAdminEmail", "updatedAt"
       )
       VALUES ('global', true, false, false, 10, 25, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET
         "reservedAdminEmail" = EXCLUDED."reservedAdminEmail",
         "updatedAt" = NOW()`,
      [reserved]
    );
    console.log(`PlatformSettings.reservedAdminEmail = ${reserved}`);
    console.log(
      `Seeded ${emails.length} ADMIN(s). Delete ${LOCAL_FILE} after production seed. See ${EXAMPLE_FILE}.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
