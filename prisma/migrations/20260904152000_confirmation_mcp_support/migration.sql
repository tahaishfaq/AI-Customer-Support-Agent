-- Stage 3 P0-1: generic ActionConfirmation for HTTP + MCP.

ALTER TABLE "ActionConfirmation" ALTER COLUMN "actionId" DROP NOT NULL;

ALTER TABLE "ActionConfirmation" ADD COLUMN IF NOT EXISTS "mcpToolId" TEXT;

CREATE INDEX IF NOT EXISTS "ActionConfirmation_mcpToolId_idx" ON "ActionConfirmation"("mcpToolId");

ALTER TABLE "ActionConfirmation"
  DROP CONSTRAINT IF EXISTS "ActionConfirmation_mcpToolId_fkey";

ALTER TABLE "ActionConfirmation"
  ADD CONSTRAINT "ActionConfirmation_mcpToolId_fkey"
  FOREIGN KEY ("mcpToolId") REFERENCES "AgentMcpTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one capability target.
ALTER TABLE "ActionConfirmation" DROP CONSTRAINT IF EXISTS "ActionConfirmation_capability_xor";
ALTER TABLE "ActionConfirmation"
  ADD CONSTRAINT "ActionConfirmation_capability_xor"
  CHECK (
    ("actionId" IS NOT NULL AND "mcpToolId" IS NULL)
    OR ("actionId" IS NULL AND "mcpToolId" IS NOT NULL)
  );

-- Replay protection status for one-shot WRITE execution.
DO $$ BEGIN
  ALTER TYPE "ActionConfirmationStatus" ADD VALUE IF NOT EXISTS 'CONSUMED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
