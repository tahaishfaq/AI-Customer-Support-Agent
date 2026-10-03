-- Level 3 · L5–L8 (additive). Features off until configured.

-- L5 per-resolution pricing ledger
CREATE TABLE IF NOT EXISTS "ResolutionCharge" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "agentId" TEXT,
  "amountMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'CHARGED',
  "chargedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "reverseReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResolutionCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResolutionCharge_conversationId_key" ON "ResolutionCharge"("conversationId");
CREATE INDEX IF NOT EXISTS "ResolutionCharge_userId_chargedAt_idx" ON "ResolutionCharge"("userId", "chargedAt");
CREATE INDEX IF NOT EXISTS "ResolutionCharge_status_idx" ON "ResolutionCharge"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResolutionCharge_conversationId_fkey') THEN
    ALTER TABLE "ResolutionCharge"
      ADD CONSTRAINT "ResolutionCharge_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "BillingPlan" ADD COLUMN IF NOT EXISTS "resolutionPricingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BillingPlan" ADD COLUMN IF NOT EXISTS "resolutionPriceMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BillingPlan" ADD COLUMN IF NOT EXISTS "maxResolutionsPerMonth" INTEGER NOT NULL DEFAULT 0;

-- L6 privacy
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "privacy" JSONB;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "legalHold" BOOLEAN NOT NULL DEFAULT false;

-- L7 tool embeddings cache
CREATE TABLE IF NOT EXISTS "ToolEmbedding" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "toolKey" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "embedding" vector(1536),
  "model" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ToolEmbedding_agentId_toolKey_key" ON "ToolEmbedding"("agentId", "toolKey");
CREATE INDEX IF NOT EXISTS "ToolEmbedding_agentId_idx" ON "ToolEmbedding"("agentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolEmbedding_agentId_fkey') THEN
    ALTER TABLE "ToolEmbedding"
      ADD CONSTRAINT "ToolEmbedding_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "semanticToolShortlist" BOOLEAN NOT NULL DEFAULT false;

-- L8 simulation + A/B
CREATE TABLE IF NOT EXISTS "SimulationRun" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "revisionVersion" INTEGER,
  "persona" TEXT,
  "questionCount" INTEGER NOT NULL DEFAULT 0,
  "completedCount" INTEGER NOT NULL DEFAULT 0,
  "avgCxScore" DOUBLE PRECISION,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SimulationRun_agentId_createdAt_idx" ON "SimulationRun"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "SimulationRun_workspaceId_status_idx" ON "SimulationRun"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "SimulationCase" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "persona" TEXT,
  "reply" TEXT,
  "cxScore" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SimulationCase_runId_idx" ON "SimulationCase"("runId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SimulationCase_runId_fkey') THEN
    ALTER TABLE "SimulationCase"
      ADD CONSTRAINT "SimulationCase_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SimulationRun_agentId_fkey') THEN
    ALTER TABLE "SimulationRun"
      ADD CONSTRAINT "SimulationRun_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "abTest" JSONB;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "isSimulation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "abBucket" TEXT;
