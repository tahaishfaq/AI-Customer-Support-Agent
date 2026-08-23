-- Scheduled website re-crawl interval (hours). 0 = one-time only.
ALTER TABLE "Agent" ADD COLUMN "crawlRecrawlHours" INTEGER NOT NULL DEFAULT 0;
