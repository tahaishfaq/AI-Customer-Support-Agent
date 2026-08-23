-- F01-F: correlate crawl workers with HTTP x-request-id
ALTER TABLE "SiteCrawlJob" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE INDEX IF NOT EXISTS "SiteCrawlJob_requestId_idx" ON "SiteCrawlJob"("requestId");
