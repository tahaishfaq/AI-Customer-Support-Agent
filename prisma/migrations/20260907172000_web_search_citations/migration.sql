-- Hosted web-search metadata is additive and nullable for rolling deploys.
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "citations" JSONB,
  ADD COLUMN IF NOT EXISTS "sources" JSONB;
