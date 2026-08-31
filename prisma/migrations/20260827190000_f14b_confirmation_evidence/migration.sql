-- F14-B: durable consent evidence on ActionConfirmation
ALTER TABLE "ActionConfirmation" ADD COLUMN IF NOT EXISTS "evidenceId" TEXT;
ALTER TABLE "ActionConfirmation" ADD COLUMN IF NOT EXISTS "userSubject" TEXT;
ALTER TABLE "ActionConfirmation" ADD COLUMN IF NOT EXISTS "userDisplay" TEXT;
ALTER TABLE "ActionConfirmation" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);
ALTER TABLE "ActionConfirmation" ADD COLUMN IF NOT EXISTS "decidedIp" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ActionConfirmation_evidenceId_key" ON "ActionConfirmation"("evidenceId");
CREATE INDEX IF NOT EXISTS "ActionConfirmation_userSubject_idx" ON "ActionConfirmation"("userSubject");
CREATE INDEX IF NOT EXISTS "ActionConfirmation_decidedAt_idx" ON "ActionConfirmation"("decidedAt");
