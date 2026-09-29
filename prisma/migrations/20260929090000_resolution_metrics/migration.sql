-- Level 2 · P1 resolution metrics. Additive only: nullable columns, no rewrite of existing rows.
-- Outcome of each AI reply (ANSWERED | NO_EVIDENCE | NOT_FOUND | HANDOFF | DEGRADED); null = before tracking.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "answerState" TEXT;

-- Who resolved the conversation (HUMAN from the desk; AI resolution is computed, not stored).
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "resolvedBy" TEXT;

-- Unanswered-questions and resolution queries filter AI replies by state and time.
CREATE INDEX IF NOT EXISTS "Message_answerState_createdAt_idx" ON "Message"("answerState", "createdAt");
