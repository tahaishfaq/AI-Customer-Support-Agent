-- B01 B2: BillingEvent idempotency log for SafePay webhooks

CREATE TYPE "BillingProvider" AS ENUM ('SAFEPAY');

CREATE TYPE "BillingEventProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'SAFEPAY',
    "eventType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "checkoutReference" TEXT,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processingStatus" "BillingEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "payloadHash" TEXT NOT NULL,
    "payloadRedacted" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingEvent_externalId_key" ON "BillingEvent"("externalId");
CREATE INDEX "BillingEvent_checkoutReference_idx" ON "BillingEvent"("checkoutReference");
CREATE INDEX "BillingEvent_userId_receivedAt_idx" ON "BillingEvent"("userId", "receivedAt");
