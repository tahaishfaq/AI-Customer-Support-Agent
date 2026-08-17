-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "publicKey" TEXT,
ADD COLUMN "embedEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "siteKnowledgeOrigin" TEXT,
ADD COLUMN "siteCrawledAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_publicKey_key" ON "Agent"("publicKey");

-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "origin" TEXT,
ADD COLUMN "crawlJobId" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgeDocument_crawlJobId_idx" ON "KnowledgeDocument"("crawlJobId");

-- CreateTable
CREATE TABLE "SiteCrawlJob" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'QUEUED',
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteCrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteCrawlJob_agentId_idx" ON "SiteCrawlJob"("agentId");

-- CreateIndex
CREATE INDEX "SiteCrawlJob_status_idx" ON "SiteCrawlJob"("status");

-- AddForeignKey
ALTER TABLE "SiteCrawlJob" ADD CONSTRAINT "SiteCrawlJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
