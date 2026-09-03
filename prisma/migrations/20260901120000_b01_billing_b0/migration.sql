-- B01 B0: Billing catalog + custom plan requests

CREATE TYPE "BillingPlanType" AS ENUM ('FREE', 'POPULAR', 'TEAMS', 'CUSTOM');
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');
CREATE TYPE "CustomPlanRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED', 'CONVERTED');

CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "planType" "BillingPlanType" NOT NULL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "safepayPlanId" TEXT,
    "maxWorkspaces" INTEGER NOT NULL DEFAULT 1,
    "maxAgentsPerWorkspace" INTEGER NOT NULL DEFAULT 2,
    "featuresJson" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomPlanRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "companyName" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "phone" TEXT,
    "estimatedSeats" INTEGER,
    "useCase" TEXT,
    "message" TEXT NOT NULL,
    "status" "CustomPlanRequestStatus" NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,
    "handledByAdminId" TEXT,
    "handledAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPlanRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPlan_slug_key" ON "BillingPlan"("slug");
CREATE UNIQUE INDEX "BillingPlan_planType_key" ON "BillingPlan"("planType");
CREATE INDEX "BillingPlan_isActive_sortOrder_idx" ON "BillingPlan"("isActive", "sortOrder");

CREATE INDEX "CustomPlanRequest_userId_createdAt_idx" ON "CustomPlanRequest"("userId", "createdAt");
CREATE INDEX "CustomPlanRequest_status_createdAt_idx" ON "CustomPlanRequest"("status", "createdAt");
CREATE INDEX "CustomPlanRequest_planId_idx" ON "CustomPlanRequest"("planId");

ALTER TABLE "CustomPlanRequest" ADD CONSTRAINT "CustomPlanRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomPlanRequest" ADD CONSTRAINT "CustomPlanRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomPlanRequest" ADD CONSTRAINT "CustomPlanRequest_handledByAdminId_fkey" FOREIGN KEY ("handledByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
