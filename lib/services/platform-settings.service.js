import prisma from "@/lib/prisma";

export const SETTINGS_ID = "global";

const DEFAULTS = {
  id: SETTINGS_ID,
  signupsEnabled: true,
  maintenanceMode: false,
  globalEmbedKill: false,
  maxWorkspacesPerUser: 20,
  maxAgentsPerWorkspace: 0,
};

function toSettings(row) {
  if (!row) {
    return { ...DEFAULTS, updatedAt: null };
  }
  return {
    signupsEnabled: row.signupsEnabled !== false,
    maintenanceMode: Boolean(row.maintenanceMode),
    globalEmbedKill: Boolean(row.globalEmbedKill),
    maxWorkspacesPerUser: Number(row.maxWorkspacesPerUser) || 0,
    maxAgentsPerWorkspace: Number(row.maxAgentsPerWorkspace) || 0,
    updatedAt: row.updatedAt || null,
  };
}

async function readRow() {
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      "signupsEnabled",
      "maintenanceMode",
      "globalEmbedKill",
      "maxWorkspacesPerUser",
      "maxAgentsPerWorkspace",
      "updatedAt"
    FROM "PlatformSettings"
    WHERE id = ${SETTINGS_ID}
    LIMIT 1
  `;
  return Array.isArray(rows) ? rows[0] : null;
}

async function ensureRow() {
  await prisma.$executeRaw`
    INSERT INTO "PlatformSettings" (
      id,
      "signupsEnabled",
      "maintenanceMode",
      "globalEmbedKill",
      "maxWorkspacesPerUser",
      "maxAgentsPerWorkspace",
      "updatedAt"
    )
    VALUES (
      ${SETTINGS_ID},
      true,
      false,
      false,
      20,
      0,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getPlatformSettings() {
  await ensureRow();
  const row = await readRow();
  return toSettings(row);
}

export async function updatePlatformSettings(patch) {
  const current = await getPlatformSettings();
  const next = { ...current };

  if (typeof patch.signupsEnabled === "boolean") {
    next.signupsEnabled = patch.signupsEnabled;
  }
  if (typeof patch.maintenanceMode === "boolean") {
    next.maintenanceMode = patch.maintenanceMode;
  }
  if (typeof patch.globalEmbedKill === "boolean") {
    next.globalEmbedKill = patch.globalEmbedKill;
  }
  if (patch.maxWorkspacesPerUser != null) {
    const n = Number.parseInt(patch.maxWorkspacesPerUser, 10);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      const err = new Error("Workspace cap must be 0–500 (0 = unlimited)");
      err.status = 400;
      throw err;
    }
    next.maxWorkspacesPerUser = n;
  }
  if (patch.maxAgentsPerWorkspace != null) {
    const n = Number.parseInt(patch.maxAgentsPerWorkspace, 10);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      const err = new Error("Agent cap must be 0–500 (0 = unlimited)");
      err.status = 400;
      throw err;
    }
    next.maxAgentsPerWorkspace = n;
  }

  await prisma.$executeRaw`
    UPDATE "PlatformSettings"
    SET
      "signupsEnabled" = ${next.signupsEnabled},
      "maintenanceMode" = ${next.maintenanceMode},
      "globalEmbedKill" = ${next.globalEmbedKill},
      "maxWorkspacesPerUser" = ${next.maxWorkspacesPerUser},
      "maxAgentsPerWorkspace" = ${next.maxAgentsPerWorkspace},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${SETTINGS_ID}
  `;

  const settings = await getPlatformSettings();
  return { settings, previous: current };
}
