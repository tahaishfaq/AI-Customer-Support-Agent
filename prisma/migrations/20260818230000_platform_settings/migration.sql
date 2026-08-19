CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id" TEXT NOT NULL,
    "signupsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "globalEmbedKill" BOOLEAN NOT NULL DEFAULT false,
    "maxWorkspacesPerUser" INTEGER NOT NULL DEFAULT 20,
    "maxAgentsPerWorkspace" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "updatedAt")
VALUES ('global', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
