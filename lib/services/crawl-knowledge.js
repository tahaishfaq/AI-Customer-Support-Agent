import { simpleWebsiteKnowledgeName } from "@/lib/services/website-knowledge-name";
import { CRAWL_PAGE_KNOWLEDGE_PREFIX } from "@/lib/validations/knowledge";

export { CRAWL_PAGE_KNOWLEDGE_PREFIX };

/**
 * Syncs indexed crawl pages into the existing KnowledgeDocument retrieval boundary.
 * The aggregate WEB document remains for backwards compatibility; page documents
 * provide deterministic source-level evidence and are reconciled per origin.
 * Schedules embedding replace for every touched WEB doc (stale-chunk fix).
 */
export async function syncCrawlKnowledge(db, {
  agentId,
  origin,
  crawlJobId,
  pages,
  aggregateContent,
}) {
  const indexedPages = (Array.isArray(pages) ? pages : []).filter(
    (page) => page?.url && page?.text && page?.canonicalUrl
  );
  const sourceUrls = indexedPages.map((page) => page.canonicalUrl);

  const touchedIds = [];

  const aggregateDoc = await db.$transaction(async (tx) => {
    const existing = await tx.knowledgeDocument.findMany({
      where: { agentId, type: "WEB", origin },
      select: { id: true, name: true, sourceUrl: true },
    });
    const aggregate = existing.find(
      (document) => !String(document.name || "").startsWith(CRAWL_PAGE_KNOWLEDGE_PREFIX)
    );

    for (const page of indexedPages) {
      const name = `${CRAWL_PAGE_KNOWLEDGE_PREFIX}${String(page.title || page.canonicalUrl).slice(0, 160)}`;
      const pageData = {
        name,
        type: "WEB",
        content: page.text,
        origin,
        sourceUrl: page.canonicalUrl,
        crawlJobId,
      };
      const current = existing.find(
        (document) =>
          String(document.name || "").startsWith(CRAWL_PAGE_KNOWLEDGE_PREFIX) &&
          document.sourceUrl === page.canonicalUrl
      );
      if (current) {
        const updated = await tx.knowledgeDocument.update({
          where: { id: current.id },
          data: pageData,
        });
        touchedIds.push(updated.id);
      } else {
        const created = await tx.knowledgeDocument.create({
          data: { agentId, ...pageData },
        });
        touchedIds.push(created.id);
      }
    }

    await tx.knowledgeDocument.deleteMany({
      where: {
        agentId,
        type: "WEB",
        origin,
        name: { startsWith: CRAWL_PAGE_KNOWLEDGE_PREFIX },
        ...(sourceUrls.length ? { sourceUrl: { notIn: sourceUrls } } : {}),
      },
    });

    if (aggregate) {
      const updated = await tx.knowledgeDocument.update({
        where: { id: aggregate.id },
        data: { content: aggregateContent, origin, sourceUrl: origin, crawlJobId },
      });
      touchedIds.push(updated.id);
      return updated;
    }
    const created = await tx.knowledgeDocument.create({
      data: {
        agentId,
        name: simpleWebsiteKnowledgeName(origin),
        type: "WEB",
        content: aggregateContent,
        origin,
        sourceUrl: origin,
        crawlJobId,
      },
    });
    touchedIds.push(created.id);
    return created;
  });

  // Always replace chunks on crawl write (content may change even when row existed).
  import("@/lib/services/ai/embeddings.service")
    .then(async ({ scheduleDocumentEmbed }) => {
      const unique = [...new Set(touchedIds)];
      const docs = await db.knowledgeDocument.findMany({
        where: { id: { in: unique } },
      });
      for (const doc of docs) scheduleDocumentEmbed(doc);
    })
    .catch(() => {});

  return aggregateDoc;
}
