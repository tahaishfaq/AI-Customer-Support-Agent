-- Interest-before-plans + SafePay customer profile fields; deferred crawl.
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'PK';
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "interestCompletedAt" TIMESTAMP(3);
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "safepayCustomerRef" TEXT;
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "safepayCustomerStatus" TEXT DEFAULT 'NONE';
ALTER TABLE "UserOnboarding" ADD COLUMN IF NOT EXISTS "safepayCustomerError" TEXT;

CREATE INDEX IF NOT EXISTS "UserOnboarding_interestCompletedAt_idx" ON "UserOnboarding"("interestCompletedAt");

-- Grandfather: anyone who already finished onboarding has interest complete.
UPDATE "UserOnboarding"
SET "interestCompletedAt" = "completedAt"
WHERE "completedAt" IS NOT NULL AND "interestCompletedAt" IS NULL;
