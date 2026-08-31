-- F12-U U5: optional CSAT (1–5) after Return to AI / resolve

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "csatScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "csatAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Conversation_csatAt_idx"
  ON "Conversation"("csatAt");
