-- B4: pending plan checkout (paid upgrades without early entitlement swap)
ALTER TABLE "Subscription" ADD COLUMN "pendingPlanId" TEXT;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_pendingPlanId_fkey"
  FOREIGN KEY ("pendingPlanId") REFERENCES "BillingPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Subscription_pendingPlanId_idx" ON "Subscription"("pendingPlanId");
