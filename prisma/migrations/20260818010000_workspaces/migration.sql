-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_userId_name_key" ON "Workspace"("userId", "name");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one Default Workspace per user
INSERT INTO "Workspace" ("id", "userId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'Default Workspace', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User";

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "workspaceId" TEXT;

UPDATE "Agent" AS a
SET "workspaceId" = w."id"
FROM "Workspace" AS w
WHERE w."userId" = a."userId";

ALTER TABLE "Agent" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Agent_workspaceId_idx" ON "Agent"("workspaceId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
