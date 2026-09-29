-- Level 2 · P3 team routing + SLA. Additive only: two nullable columns + one index.
-- Workspace desk routing: { assignment: owner|least_busy|manual, pool: [userId], slaFirstReplyMinutes }; null = owner (today).
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "deskSettings" JSONB;

-- First human reply after the latest handoff (SLA "first response"); reset on each new handoff.
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "firstHumanReplyAt" TIMESTAMP(3);

-- Least-busy routing counts open assigned chats per teammate.
CREATE INDEX IF NOT EXISTS "Conversation_assignedUserId_status_idx" ON "Conversation"("assignedUserId", "status");
