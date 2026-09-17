-- Additive crawl frontier and per-page provenance.
ALTER TYPE "CrawlJobStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';

CREATE TYPE "CrawlPageStatus" AS ENUM ('DISCOVERED', 'FETCHED', 'INDEXED', 'SKIPPED', 'FAILED');

ALTER TABLE "SiteCrawlJob"
  ADD COLUMN "discoveredCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fetchedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "indexedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pendingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "budgetExhausted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "coverageJson" JSONB;

CREATE TABLE "SiteCrawlPage" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "canonicalUrl" TEXT NOT NULL,
  "status" "CrawlPageStatus" NOT NULL DEFAULT 'DISCOVERED',
  "depth" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT,
  "content" TEXT,
  "contentHash" TEXT,
  "skipReason" TEXT,
  "error" TEXT,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fetchedAt" TIMESTAMP(3),
  "indexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteCrawlPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteCrawlPage_jobId_canonicalUrl_key" ON "SiteCrawlPage"("jobId", "canonicalUrl");
CREATE INDEX "SiteCrawlPage_jobId_status_idx" ON "SiteCrawlPage"("jobId", "status");
CREATE INDEX "SiteCrawlPage_canonicalUrl_idx" ON "SiteCrawlPage"("canonicalUrl");
ALTER TABLE "SiteCrawlPage" ADD CONSTRAINT "SiteCrawlPage_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "SiteCrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
