-- B01: monthly conversation quota per billing plan (Botpress-style metering)

ALTER TABLE "BillingPlan"
ADD COLUMN "maxConversationsPerMonth" INTEGER NOT NULL DEFAULT 0;

UPDATE "BillingPlan" SET "maxConversationsPerMonth" = 100 WHERE "planType" = 'FREE';
UPDATE "BillingPlan" SET "maxConversationsPerMonth" = 250 WHERE "planType" = 'POPULAR';
UPDATE "BillingPlan" SET "maxConversationsPerMonth" = 1500 WHERE "planType" = 'TEAMS';
-- CUSTOM stays 0 = unlimited until sales sets a negotiated cap in admin
