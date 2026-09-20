-- CreateTable
CREATE TABLE IF NOT EXISTS "EndUser" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndUser_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "endUserId" TEXT;

-- AlterTable
ALTER TABLE "ToolRun" ADD COLUMN IF NOT EXISTS "turnRunId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EndUser_workspaceId_subject_key" ON "EndUser"("workspaceId", "subject");
CREATE INDEX IF NOT EXISTS "EndUser_workspaceId_lastSeenAt_idx" ON "EndUser"("workspaceId", "lastSeenAt");
CREATE INDEX IF NOT EXISTS "Conversation_endUserId_idx" ON "Conversation"("endUserId");
CREATE INDEX IF NOT EXISTS "ToolRun_turnRunId_idx" ON "ToolRun"("turnRunId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EndUser" ADD CONSTRAINT "EndUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ToolRun" ADD CONSTRAINT "ToolRun_turnRunId_fkey" FOREIGN KEY ("turnRunId") REFERENCES "TurnRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
