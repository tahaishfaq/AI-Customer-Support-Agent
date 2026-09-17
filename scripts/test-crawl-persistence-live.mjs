import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import crawlKnowledgeModule from "../lib/services/crawl-knowledge.js";

const syncCrawlKnowledge =
  crawlKnowledgeModule.syncCrawlKnowledge || crawlKnowledgeModule.default?.syncCrawlKnowledge;
import prismaModule from "../lib/prisma.js";

const prisma = prismaModule.default || prismaModule;

const suffix = randomUUID().slice(0, 12);
const email = `crawl-persistence-${suffix}@example.invalid`;
let userId;

try {
  const user = await prisma.user.create({
    data: { name: "Crawl persistence test", email },
    select: { id: true },
  });
  userId = user.id;
  const workspace = await prisma.workspace.create({
    data: { userId, name: `Crawl persistence ${suffix}`, slug: `crawl-${suffix}` },
    select: { id: true },
  });
  const agent = await prisma.agent.create({
    data: {
      userId,
      workspaceId: workspace.id,
      name: `Crawl persistence ${suffix}`,
      systemPrompt: "Test-only agent.",
      welcomeMessage: "Test-only agent.",
    },
    select: { id: true },
  });

  const job = await prisma.siteCrawlJob.create({
    data: { agentId: agent.id, origin: "https://example.com", status: "QUEUED" },
    select: { id: true },
  });

  const pageData = {
    jobId: job.id,
    url: "https://example.com/docs",
    canonicalUrl: "https://example.com/docs",
    status: "DISCOVERED",
    depth: 1,
  };
  await prisma.siteCrawlPage.create({ data: pageData });
  const resumed = await prisma.siteCrawlPage.findMany({
    where: { jobId: job.id, status: "DISCOVERED" },
    select: { url: true, depth: true },
  });
  assert.deepEqual(resumed, [{ url: pageData.url, depth: 1 }], "discovered page is resumable");

  const indexed = await prisma.siteCrawlPage.upsert({
    where: { jobId_canonicalUrl: { jobId: job.id, canonicalUrl: pageData.canonicalUrl } },
    create: {
      ...pageData,
      status: "INDEXED",
      title: "Docs",
      content: "Public documentation.",
      contentHash: "a".repeat(64),
      fetchedAt: new Date(),
      indexedAt: new Date(),
    },
    update: {
      status: "INDEXED",
      title: "Docs",
      content: "Public documentation.",
      contentHash: "a".repeat(64),
      fetchedAt: new Date(),
      indexedAt: new Date(),
    },
    select: { status: true, contentHash: true },
  });
  assert.equal(indexed.status, "INDEXED");
  assert.equal(indexed.contentHash, "a".repeat(64));
  assert.equal(await prisma.siteCrawlPage.count({ where: { jobId: job.id } }), 1, "upsert is idempotent");

  await syncCrawlKnowledge(prisma, {
    agentId: agent.id,
    origin: "https://example.com",
    crawlJobId: job.id,
    pages: [{ url: pageData.url, canonicalUrl: pageData.canonicalUrl, title: "Docs", text: "Public documentation." }],
    aggregateContent: "Aggregate public documentation.",
  });
  const firstKnowledge = await prisma.knowledgeDocument.findMany({
    where: { agentId: agent.id, type: "WEB" },
    select: { name: true, sourceUrl: true, content: true },
  });
  assert.equal(firstKnowledge.length, 2, "aggregate plus page knowledge are indexed");
  assert.ok(firstKnowledge.some((doc) => doc.sourceUrl === pageData.canonicalUrl), "page source is searchable");

  await syncCrawlKnowledge(prisma, {
    agentId: agent.id,
    origin: "https://example.com",
    crawlJobId: job.id,
    pages: [{ url: "https://example.com/new", canonicalUrl: "https://example.com/new", title: "New", text: "New public documentation." }],
    aggregateContent: "Updated aggregate documentation.",
  });
  const reconciled = await prisma.knowledgeDocument.findMany({
    where: { agentId: agent.id, type: "WEB" },
    select: { sourceUrl: true, content: true },
  });
  assert.equal(reconciled.length, 2, "stale page is reconciled without deleting aggregate knowledge");
  assert.equal(reconciled.some((doc) => doc.sourceUrl === pageData.canonicalUrl), false, "removed page is deleted");
  assert.ok(reconciled.some((doc) => doc.sourceUrl === "https://example.com/new"), "new page is indexed");

  const partial = await prisma.siteCrawlJob.update({
    where: { id: job.id },
    data: {
      status: "PARTIAL",
      pagesCrawled: 1,
      discoveredCount: 1,
      fetchedCount: 1,
      indexedCount: 1,
      pendingCount: 2,
      budgetExhausted: true,
      coverageJson: { discovered: 1, pending: 2, budgetExhausted: true },
    },
    select: { status: true, pendingCount: true, budgetExhausted: true, coverageJson: true },
  });
  assert.deepEqual(partial, {
    status: "PARTIAL",
    pendingCount: 2,
    budgetExhausted: true,
    coverageJson: { discovered: 1, pending: 2, budgetExhausted: true },
  });

  console.log("PASS live crawl persistence: frontier resume, provenance upsert, page RAG sync/reconcile, partial coverage, idempotency");
} finally {
  if (userId) await prisma.user.delete({ where: { id: userId } });
}
