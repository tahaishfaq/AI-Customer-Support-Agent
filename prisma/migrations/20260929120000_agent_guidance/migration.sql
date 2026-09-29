-- Level 2 · P2 guidance rules. Additive only: one nullable JSON column; existing agents get NULL (no rules).
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "guidance" JSONB;
