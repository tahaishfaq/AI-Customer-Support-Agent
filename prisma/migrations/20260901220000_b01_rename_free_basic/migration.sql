-- Rename Free plan display name to Basic (planType remains FREE)
UPDATE "BillingPlan" SET name = 'Basic', "updatedAt" = NOW() WHERE "planType" = 'FREE';
