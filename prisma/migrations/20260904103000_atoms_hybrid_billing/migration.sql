-- Hybrid Atoms billing: billingMode, payment method ref, PaymentAttempt.

CREATE TYPE "BillingMode" AS ENUM ('LEGACY_NATIVE', 'ATOMS_HYBRID');
CREATE TYPE "PaymentAttemptType" AS ENUM ('INITIAL', 'RENEWAL', 'RETRY');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "billingMode" "BillingMode" NOT NULL DEFAULT 'LEGACY_NATIVE',
  ADD COLUMN IF NOT EXISTS "safepayPaymentMethodRef" TEXT,
  ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3);

-- Existing paid / any open rows stay native.
UPDATE "Subscription" SET "billingMode" = 'LEGACY_NATIVE' WHERE "billingMode" IS NULL;

CREATE TABLE IF NOT EXISTS "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "planId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL DEFAULT 'SAFEPAY',
  "checkoutReference" TEXT NOT NULL,
  "trackerToken" TEXT,
  "customerRef" TEXT,
  "instrumentRef" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PKR',
  "type" "PaymentAttemptType" NOT NULL DEFAULT 'INITIAL',
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAttempt_checkoutReference_key" ON "PaymentAttempt"("checkoutReference");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_userId_createdAt_idx" ON "PaymentAttempt"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_subscriptionId_status_idx" ON "PaymentAttempt"("subscriptionId", "status");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_trackerToken_idx" ON "PaymentAttempt"("trackerToken");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Subscription_billingMode_status_currentPeriodEnd_idx" ON "Subscription"("billingMode", "status", "currentPeriodEnd");

ALTER TABLE "PaymentAttempt"
  DROP CONSTRAINT IF EXISTS "PaymentAttempt_subscriptionId_fkey";
ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
