-- B01 B1: Subscription model + existing-user Free grandfather

CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "safepaySubscriptionToken" TEXT,
    "safepayCustomerRef" TEXT,
    "checkoutReference" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "lastPaymentAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_checkoutReference_key" ON "Subscription"("checkoutReference");
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
CREATE INDEX "Subscription_userId_createdAt_idx" ON "Subscription"("userId", "createdAt");

CREATE UNIQUE INDEX "Subscription_user_open_key"
  ON "Subscription"("userId")
  WHERE "status" IN ('PENDING', 'ACTIVE', 'PAST_DUE');

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grandfather existing USER accounts onto Free ACTIVE (ADMIN excluded).
INSERT INTO "Subscription" (
  "id",
  "userId",
  "planId",
  "status",
  "activatedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  u."id",
  p."id",
  'ACTIVE'::"SubscriptionStatus",
  NOW(),
  NOW(),
  NOW()
FROM "User" u
CROSS JOIN "BillingPlan" p
WHERE u."role" = 'USER'
  AND p."planType" = 'FREE'
  AND NOT EXISTS (
    SELECT 1
    FROM "Subscription" s
    WHERE s."userId" = u."id"
      AND s."status" IN ('PENDING', 'ACTIVE', 'PAST_DUE')
  );
