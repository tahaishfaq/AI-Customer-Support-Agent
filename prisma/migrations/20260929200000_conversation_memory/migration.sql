-- Conversation memory. Additive only: three nullable columns, no backfill, no index.
-- Rolling summary of messages older than the 20-message history window (plain text, data only).
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "memorySummary" TEXT;
-- createdAt of the newest message folded into memorySummary (optimistic update guard).
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "memorySummaryUpTo" TIMESTAMP(3);

-- Compact public tool results behind an assistant reply, replayed as fenced data on later turns.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "toolMemory" JSONB;
