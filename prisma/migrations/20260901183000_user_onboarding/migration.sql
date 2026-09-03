-- B01 onboarding profile + public website crawl metadata

CREATE TYPE "OnboardingCrawlStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

CREATE TABLE "UserOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "companyType" TEXT,
    "teamSize" TEXT,
    "monthlyConversations" TEXT,
    "primaryGoal" TEXT,
    "businessProfileJson" JSONB,
    "crawlStatus" "OnboardingCrawlStatus" NOT NULL DEFAULT 'PENDING',
    "crawlError" TEXT,
    "crawledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserOnboarding_userId_key" ON "UserOnboarding"("userId");
CREATE INDEX "UserOnboarding_completedAt_idx" ON "UserOnboarding"("completedAt");
CREATE INDEX "UserOnboarding_crawlStatus_idx" ON "UserOnboarding"("crawlStatus");

ALTER TABLE "UserOnboarding" ADD CONSTRAINT "UserOnboarding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing active subscribers skip onboarding (grandfather).
INSERT INTO "UserOnboarding" (
  "id",
  "userId",
  "crawlStatus",
  "completedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  s."userId",
  'SKIPPED'::"OnboardingCrawlStatus",
  NOW(),
  NOW(),
  NOW()
FROM "Subscription" s
WHERE s."status" = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM "UserOnboarding" o WHERE o."userId" = s."userId"
  );
