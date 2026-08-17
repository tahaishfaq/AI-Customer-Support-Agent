import prisma from "@/lib/prisma";
import { createPublicKey } from "@/lib/public-key";
import {
  compileWebsiteDoc,
  crawlPublicOrigin,
  shouldSkipCrawlOrigin,
} from "@/lib/services/site-crawler";
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

export async function getPublicAgentByKey(publicKey) {
  if (!publicKey) return null;
  const agent = await prisma.agent.findUnique({
    where: { publicKey },
  });
  if (!agent || agent.embedEnabled === false) return null;
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

/**
 * First successful crawl wins. Ping is a no-op afterwards.
 */
export async function enqueueOneTimeCrawl(agentId, rawOrigin) {
  const decision = shouldSkipCrawlOrigin(rawOrigin, appOrigin());
  if (decision.skip) {
    return { queued: false, reason: decision.reason };
  }
  const origin = decision.origin;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return { queued: false, reason: "missing" };
  if (agent.siteCrawledAt) return { queued: false, reason: "already" };

  if (agent.siteKnowledgeOrigin && agent.siteKnowledgeOrigin !== origin) {
    return { queued: false, reason: "locked-other-origin" };
  }

  const active = await prisma.siteCrawlJob.findFirst({
    where: {
      agentId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });
  if (active) return { queued: false, reason: "in-flight", jobId: active.id };

  if (!agent.siteKnowledgeOrigin) {
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
    },
  });

  return { queued: true, jobId: job.id, origin };
}

export async function runCrawlJob(jobId) {
  const job = await prisma.siteCrawlJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "DONE" || job.status === "RUNNING") return;

  const agent = await prisma.agent.findUnique({ where: { id: job.agentId } });
  if (!agent) return;
  if (agent.siteCrawledAt) {
    await prisma.siteCrawlJob.update({
      where: { id: jobId },
      data: { status: "DONE", finishedAt: new Date(), error: "already crawled" },
    });
    return;
  }

  await prisma.siteCrawlJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
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
    await prisma.siteCrawlJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: String(error?.message || "Crawl failed").slice(0, 500),
      },
    });
  }
}
