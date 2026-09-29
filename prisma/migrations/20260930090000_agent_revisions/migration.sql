-- Level 2 · P5 agent versioning. Additive only: one new table, nothing existing changes.
CREATE TABLE IF NOT EXISTS "AgentRevision" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentRevision_agentId_version_key" ON "AgentRevision"("agentId", "version");
CREATE INDEX IF NOT EXISTS "AgentRevision_agentId_createdAt_idx" ON "AgentRevision"("agentId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AgentRevision" ADD CONSTRAINT "AgentRevision_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
