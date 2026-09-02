-- F12-U U1–U3: claim, priority, canned replies

CREATE TYPE "HandoffPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "handoffPriority" "HandoffPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Conversation_handoffPriority_idx"
  ON "Conversation"("handoffPriority");

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "deskCannedReplies" JSONB;
