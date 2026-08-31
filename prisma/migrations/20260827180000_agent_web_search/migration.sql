-- Knowledge: optional web/general knowledge for the agent (default off).
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "webSearchEnabled" BOOLEAN NOT NULL DEFAULT false;
