import prisma from "@/lib/prisma";
import { createPublicKey } from "@/lib/public-key";
import {
  compileWebsiteDoc,
  crawlPublicOrigin,
  shouldSkipCrawlOrigin,
} from "@/lib/services/site-crawler";
import { isRecrawlDue } from "@/lib/services/crawl-schedule";
import { redactPublicText } from "@/lib/services/site-redact";
import { syncCrawlKnowledge } from "@/lib/services/crawl-knowledge";

function appOrigin() {
  const raw =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    "";
  try {
    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
}

export async function ensureAgentPublicKey(agent) {
  if (agent.publicKey) return agent;
  for (let i = 0; i < 4; i += 1) {
    try {
      return await prisma.agent.update({
        where: { id: agent.id },
        data: { publicKey: createPublicKey() },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
    }
  }
  return agent;
}

export function toPublicAgentView(agent) {
  return {
    publicKey: agent.publicKey,
    name: agent.name,
    welcomeMessage: agent.welcomeMessage,
    customization: agent.customization,
    webSearchEnabled: agent.webSearchEnabled === true,
    embedEnabled: agent.embedEnabled !== false,
  };
}

async function hasWebsiteKnowledge(agentId) {
  const count = await prisma.knowledgeDocument.count({
    where: { agentId, type: "WEB" },
  });
  return count > 0;
}

/**
 * Issue a new embed publicKey. The previous key is dropped from the agent
 * so old snippets and /w/{oldKey} stop resolving immediately.
 * If website crawl knowledge was deleted, unlock one crawl for the new snippet.
 */
export async function rotateAgentPublicKey(agent) {
  const hasWeb = await hasWebsiteKnowledge(agent.id);
  const crawlReset = hasWeb
    ? {}
    : { siteCrawledAt: null, siteKnowledgeOrigin: null };

  for (let i = 0; i < 6; i += 1) {
    const nextKey = createPublicKey();
    if (nextKey === agent.publicKey) continue;
    try {
      return await prisma.agent.update({
        where: { id: agent.id },
        data: {
          publicKey: nextKey,
          embedEnabled: true,
          ...crawlReset,
        },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
    }
  }
  const err = new Error("Unable to regenerate embed key");
  err.status = 500;
  throw err;
}

export async function getPublicAgentByKey(publicKey, { origin } = {}) {
  if (!publicKey) return null;
  const { getPlatformSettings } = await import(
    "@/lib/services/platform-settings.service"
  );
  const settings = await getPlatformSettings();
  if (settings.globalEmbedKill) return null;
  const agent = await prisma.agent.findUnique({
    where: { publicKey },
  });
  if (!agent || agent.embedEnabled === false || agent.enabled === false) return null;

  const decision = origin
    ? shouldSkipCrawlOrigin(origin, appOrigin())
    : null;

  // Locked agents require a trusted request origin that matches (or app/localhost preview).
  // Do not trust client-supplied query/body origins alone — callers must pass Origin/Referer.
  if (agent.siteKnowledgeOrigin) {
    if (!decision) return null;
    if (decision.skip) {
      if (
        decision.reason !== "own-product" &&
        decision.reason !== "localhost"
      ) {
        return null;
      }
    } else if (decision.origin !== agent.siteKnowledgeOrigin) {
      return null;
    }
  } else if (decision && !decision.skip) {
    const taken = await prisma.agent.findFirst({
      where: {
        siteKnowledgeOrigin: decision.origin,
        NOT: { id: agent.id },
      },
      select: { id: true },
    });
    if (taken) return null;
  }

  return agent;
}

/**
 * Bind this agent to the first public https origin that loads the widget.
 * One agent ↔ one website. Localhost / our own app does not count.
 */
export async function claimEmbedOrigin(agentId, rawOrigin, options = {}) {
  const requestId = options.requestId;
  const decision = shouldSkipCrawlOrigin(rawOrigin, appOrigin());
  if (decision.skip) {
    return { allowed: true, live: false, queued: false, reason: decision.reason };
  }
  const origin = decision.origin;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return { allowed: false, live: false, reason: "missing" };

  if (agent.siteKnowledgeOrigin && agent.siteKnowledgeOrigin !== origin) {
    return {
      allowed: false,
      live: false,
      reason: "agent_locked",
      origin: agent.siteKnowledgeOrigin,
    };
  }

  const taken = await prisma.agent.findFirst({
    where: { siteKnowledgeOrigin: origin, NOT: { id: agentId } },
    select: { id: true },
  });
  if (taken) {
    return { allowed: false, live: false, reason: "origin_taken" };
  }

  if (!agent.siteKnowledgeOrigin) {
    try {
      await prisma.agent.update({
        where: { id: agentId },
        data: { siteKnowledgeOrigin: origin, embedLastPingAt: new Date() },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        return { allowed: false, live: false, reason: "origin_taken" };
      }
      throw error;
    }
  } else {
    await prisma.agent.update({
      where: { id: agentId },
      data: { embedLastPingAt: new Date() },
    });
  }

  const crawl = await enqueueOneTimeCrawl(agentId, origin, { requestId });
  return { allowed: true, live: true, origin, ...crawl };
}

/**
 * Queue a site crawl when knowledge is empty, or when a recrawl schedule is due.
 * Locked after a WEB doc exists unless crawlRecrawlHours > 0 and interval elapsed.
 */
export async function enqueueOneTimeCrawl(agentId, rawOrigin, options = {}) {
  const requestId = options.requestId;
  const decision = shouldSkipCrawlOrigin(rawOrigin, appOrigin());
  if (decision.skip) {
    return { queued: false, reason: decision.reason };
  }
  const origin = decision.origin;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return { queued: false, reason: "missing" };

  const hasWeb = await hasWebsiteKnowledge(agentId);
  const recrawlDue = hasWeb && isRecrawlDue(agent);
  if (agent.siteCrawledAt && hasWeb && !recrawlDue) {
    return { queued: false, reason: "already" };
  }

  if (
    hasWeb &&
    agent.siteKnowledgeOrigin &&
    agent.siteKnowledgeOrigin !== origin
  ) {
    return { queued: false, reason: "locked-other-origin" };
  }

  const active = await prisma.siteCrawlJob.findFirst({
    where: {
      agentId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });
  if (active) return { queued: false, reason: "in-flight", jobId: active.id };

  if (!hasWeb && agent.siteKnowledgeOrigin !== origin) {
    await prisma.agent.update({
      where: { id: agentId },
      data: { siteKnowledgeOrigin: origin, siteCrawledAt: null },
    });
  } else if (!agent.siteKnowledgeOrigin) {
    await prisma.agent.update({
      where: { id: agentId },
      data: { siteKnowledgeOrigin: origin },
    });
  }

  const job = await prisma.siteCrawlJob.create({
    data: {
      agentId,
      origin,
      status: "QUEUED",
      requestId: requestId || null,
    },
  });

  return { queued: true, jobId: job.id, origin, requestId: job.requestId, recrawl: recrawlDue };
}

export async function runCrawlJob(jobId, options = {}) {
  const job = await prisma.siteCrawlJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "DONE") return;
  if (job.status === "RUNNING") {
    const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : 0;
    if (!startedAt || Date.now() - startedAt < 15 * 60 * 1000) return;
    await prisma.siteCrawlJob.update({ where: { id: jobId }, data: { status: "QUEUED" } });
  }

  const requestId = options.requestId || job.requestId || undefined;

  const agent = await prisma.agent.findUnique({ where: { id: job.agentId } });
  if (!agent) return;
  const hasWeb = await hasWebsiteKnowledge(job.agentId);
  const recrawlDue = hasWeb && isRecrawlDue(agent);
  if (agent.siteCrawledAt && hasWeb && !recrawlDue) {
    await prisma.siteCrawlJob.update({
      where: { id: jobId },
      data: { status: "DONE", finishedAt: new Date(), error: "already crawled" },
    });
    return;
  }

  await prisma.siteCrawlJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      error: null,
      ...(requestId && !job.requestId ? { requestId } : {}),
    },
  });

  try {
    const resumePages = await prisma.siteCrawlPage.findMany({
      where: { jobId, status: "DISCOVERED" },
      select: { url: true, canonicalUrl: true, depth: true },
      orderBy: { discoveredAt: "asc" },
    });
    const persistPage = async (page) => {
      const canonicalUrl = page.canonicalUrl || page.url;
      const data = {
        url: page.url,
        canonicalUrl,
        status: page.status,
        depth: page.depth || 0,
        ...(page.title !== undefined ? { title: page.title || null } : {}),
        ...(page.content !== undefined ? { content: page.content || null } : {}),
        ...(page.contentHash !== undefined ? { contentHash: page.contentHash || null } : {}),
        ...(page.skipReason !== undefined ? { skipReason: page.skipReason || null } : {}),
        ...(page.error !== undefined ? { error: page.error || null } : {}),
        ...(page.status === "INDEXED" ? { fetchedAt: new Date(), indexedAt: new Date() } : {}),
      };
      await prisma.siteCrawlPage.upsert({
        where: { jobId_canonicalUrl: { jobId, canonicalUrl } },
        create: { jobId, ...data },
        update: data,
      });
    };
    const { origin, pages, coverage = {} } = await crawlPublicOrigin(job.origin, {
      resumeUrls: resumePages,
      onDiscovered: (page) => persistPage({ ...page, status: "DISCOVERED" }),
      onPage: persistPage,
    });
    if (!pages.length) {
      throw new Error("No public support pages found");
    }

    let content = await compileWebsiteDoc(origin, pages);
    content = redactPublicText(content);
    if (!content || content.length < 40) {
      content = pages.map((p) => `${p.title}\n${p.text}`).join("\n\n").slice(0, 20_000);
      content = redactPublicText(content);
    }

    await syncCrawlKnowledge(prisma, {
      agentId: job.agentId,
      origin,
      crawlJobId: job.id,
      pages,
      aggregateContent: content,
    });

    const partial =
      coverage.budgetExhausted === true ||
      Number(coverage.pending || 0) > 0 ||
      Number(coverage.failed || 0) > 0;
    await prisma.$transaction([
      prisma.siteCrawlJob.update({
        where: { id: jobId },
        data: {
          status: partial ? "PARTIAL" : "DONE",
          pagesCrawled: pages.length,
          discoveredCount: Number(coverage.discovered || 0),
          fetchedCount: Number(coverage.fetched || 0),
          indexedCount: Number(coverage.indexed || pages.length),
          skippedCount: Number(coverage.privateSkipped || 0) + Number(coverage.nonHtmlSkipped || 0) + Number(coverage.robotsBlocked || 0),
          pendingCount: Number(coverage.pending || 0),
          budgetExhausted: partial,
          coverageJson: coverage,
          finishedAt: new Date(),
          error: partial
            ? "CRAWL_PARTIAL: frontier incomplete or page failures recorded"
            : null,
        },
      }),
      prisma.agent.update({
        where: { id: job.agentId },
        data: {
          siteKnowledgeOrigin: origin,
          siteCrawledAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    const { safeLogError } = await import("@/lib/observability/safe-log");
    const { enqueueDeadLetter } = await import(
      "@/lib/observability/dead-letter"
    );
    safeLogError("siteCrawl failed", {
      jobId,
      agentId: job?.agentId,
      requestId,
      code: "CRAWL_FAILED",
    });
    await enqueueDeadLetter({
      jobType: "site-crawl",
      jobId,
      agentId: job?.agentId,
      requestId,
      code: "CRAWL_FAILED",
      reason: String(error?.message || "Crawl failed").slice(0, 200),
    });
    await prisma.siteCrawlJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: `CRAWL_FAILED: ${String(error?.message || "Crawl failed").slice(0, 480)}`,
      },
    });
  }
}
