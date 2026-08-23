-- F12 Human Desk — conversation status, handoff fields, HUMAN message role

CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'WAITING_HUMAN', 'RESOLVED');

ALTER TYPE "MessageRole" ADD VALUE 'HUMAN';

ALTER TABLE "Conversation"
  ADD COLUMN "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "handoffReason" TEXT,
  ADD COLUMN "handoffAt" TIMESTAMP(3),
  ADD COLUMN "assignedUserId" TEXT,
  ADD COLUMN "aiPaused" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Conversation_agentId_status_handoffAt_idx"
  ON "Conversation"("agentId", "status", "handoffAt");

CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

CREATE INDEX "Conversation_assignedUserId_idx" ON "Conversation"("assignedUserId");
