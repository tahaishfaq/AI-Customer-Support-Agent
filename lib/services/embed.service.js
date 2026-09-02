import prisma from "@/lib/prisma";
import { createPublicKey } from "@/lib/public-key";
import {
  compileWebsiteDoc,
  crawlPublicOrigin,
  shouldSkipCrawlOrigin,
} from "@/lib/services/site-crawler";
import { isRecrawlDue } from "@/lib/services/crawl-schedule";
import { redactPublicText } from "@/lib/services/site-redact";

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
        data: { siteKnowledgeOrigin: origin },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        return { allowed: false, live: false, reason: "origin_taken" };
      }
      throw error;
    }
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
  if (job.status === "DONE" || job.status === "RUNNING") return;

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
    const { origin, pages } = await crawlPublicOrigin(job.origin);
    if (!pages.length) {
      throw new Error("No public support pages found");
    }

    let content = await compileWebsiteDoc(origin, pages);
    content = redactPublicText(content);
    if (!content || content.length < 40) {
      content = pages.map((p) => `${p.title}\n${p.text}`).join("\n\n").slice(0, 20_000);
      content = redactPublicText(content);
    }

    const existingWeb = await prisma.knowledgeDocument.findMany({
      where: { agentId: job.agentId, type: "WEB" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (existingWeb.length === 0) {
      await prisma.knowledgeDocument.create({
        data: {
          agentId: job.agentId,
          name: `Website — ${new URL(origin).hostname}`,
          type: "WEB",
          content,
          origin,
          sourceUrl: origin,
          crawlJobId: job.id,
        },
      });
    } else {
      await prisma.knowledgeDocument.update({
        where: { id: existingWeb[0].id },
        data: {
          content,
          origin,
          sourceUrl: origin,
          crawlJobId: job.id,
        },
      });
    }

    await prisma.$transaction([
      prisma.siteCrawlJob.update({
        where: { id: jobId },
        data: {
          status: "DONE",
          pagesCrawled: pages.length,
          finishedAt: new Date(),
          error: null,
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
