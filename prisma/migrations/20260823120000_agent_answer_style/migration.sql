-- F09-C: optional short vs detailed reply bias per agent
ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "answerStyle" TEXT NOT NULL DEFAULT 'DETAILED';
