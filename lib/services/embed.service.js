import prisma from "@/lib/prisma";
import { createPublicKey } from "@/lib/public-key";
import { stripWhiteLabel } from "@/lib/customization/white-label";
import {
  compileWebsiteDoc,
  crawlPublicOrigin,
  isAideDocsPath,
  shouldSkipCrawlOrigin,
} from "@/lib/services/site-crawler";
import {
  crawlPublicOriginBrowser,
  isCrawlBrowserEnabled,
} from "@/lib/services/site-crawler-browser";
import { isRecrawlDue } from "@/lib/services/crawl-schedule";
import { redactPublicText } from "@/lib/services/site-redact";
import { syncCrawlKnowledge } from "@/lib/services/crawl-knowledge";
import { assertAgentAllowedOrigin } from "@/lib/embed/allowed-origins";
import { logCrawlEvent } from "@/lib/services/crawl-observability";

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

/**
 * Public widget payload. Without white-label access the paid branding fields are stripped
 * here, so a downgraded plan reverts to AIDE branding without touching stored settings.
 */
export function toPublicAgentView(agent, { whiteLabel = false } = {}) {
  return {
    publicKey: agent.publicKey,
    name: agent.name,
    welcomeMessage: agent.welcomeMessage,
    customization: whiteLabel ? agent.customization : stripWhiteLabel(agent.customization),
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
 * Origin may be shared by agents in the same workspace.
 * Block only when a different workspace already claimed it.
 * @param {string} origin
 * @param {{ agentId: string, workspaceId: string }} self
 * @returns {Promise<{ id: string, name: string|null }|null>}
 */
export async function findOriginTakenOutsideWorkspace(origin, self) {
  if (!origin || !self?.workspaceId) return null;
  return prisma.agent.findFirst({
    where: {
      siteKnowledgeOrigin: origin,
      NOT: { id: self.agentId },
      workspaceId: { not: self.workspaceId },
    },
    select: { id: true, name: true },
  });
}

/**
 * Owner Deploy / Features: validate claiming siteKnowledgeOrigin for an allowlist base URL.
 * Same-workspace share allowed; cross-workspace still blocked. Does not write.
 * @param {{ id: string, workspaceId: string, siteKnowledgeOrigin?: string|null }} agent
 * @param {string} origin
 * @returns {Promise<{ ok: true, shouldClaim: boolean } | { ok: false, reason: string, origin?: string, takenByAgentId?: string, takenByAgentName?: string|null }>}
 */
export async function validateOwnerSiteOriginClaim(agent, origin) {
  const normalized = String(origin || "").trim();
  if (!agent?.id || !normalized) {
    return { ok: false, reason: "missing" };
  }
  if (agent.siteKnowledgeOrigin && agent.siteKnowledgeOrigin !== normalized) {
    return {
      ok: false,
      reason: "agent_locked",
      origin: agent.siteKnowledgeOrigin,
    };
  }
  if (agent.siteKnowledgeOrigin === normalized) {
    return { ok: true, shouldClaim: false };
  }
  const taken = await findOriginTakenOutsideWorkspace(normalized, {
    agentId: agent.id,
    workspaceId: agent.workspaceId,
  });
  if (taken) {
    return {
      ok: false,
      reason: "origin_taken",
      takenByAgentId: taken.id,
      takenByAgentName: taken.name || null,
    };
  }
  return { ok: true, shouldClaim: true };
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
    const taken = await findOriginTakenOutsideWorkspace(decision.origin, {
      agentId: agent.id,
      workspaceId: agent.workspaceId,
    });
    if (taken) return null;
  }

  // Customization allowlist (features.allowedOriginsMode=allowlist) — enforced server-side.
  const allowGate = assertAgentAllowedOrigin(agent, decision, origin);
  if (!allowGate.ok) return null;

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

  const allowGate = assertAgentAllowedOrigin(
    agent,
    { skip: false, origin },
    origin
  );
  if (!allowGate.ok) {
    return { allowed: false, live: false, reason: allowGate.reason };
  }

  if (agent.siteKnowledgeOrigin && agent.siteKnowledgeOrigin !== origin) {
    return {
      allowed: false,
      live: false,
      reason: "agent_locked",
      origin: agent.siteKnowledgeOrigin,
    };
  }

  const taken = await findOriginTakenOutsideWorkspace(origin, {
    agentId,
    workspaceId: agent.workspaceId,
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
 * Owner dashboard retry may pass `force: true` after a FAILED job (same origin).
 */
export async function enqueueOneTimeCrawl(agentId, rawOrigin, options = {}) {
  const requestId = options.requestId;
  const force = options.force === true;
  const startUrlRaw = String(options.startUrl || "").trim();
  const startUrlList = Array.isArray(options.startUrls)
    ? options.startUrls.map((u) => String(u || "").trim()).filter(Boolean)
    : [];
  if (startUrlRaw) startUrlList.unshift(startUrlRaw);

  const docsOnly =
    startUrlList.length > 0 &&
    startUrlList.every((u) => {
      try {
        return isAideDocsPath(new URL(u).pathname);
      } catch {
        return false;
      }
    });

  const decision = shouldSkipCrawlOrigin(rawOrigin, appOrigin(), {
    allowAideDocs: docsOnly,
  });
  if (decision.skip) {
    return { queued: false, reason: decision.reason };
  }
  const origin = decision.origin;
  const pathPrefix = decision.pathPrefix || (docsOnly ? "/docs" : null);

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return { queued: false, reason: "missing" };

  const hasWeb = await hasWebsiteKnowledge(agentId);
  const recrawlDue = hasWeb && isRecrawlDue(agent);
  if (!force && agent.siteCrawledAt && hasWeb && !recrawlDue) {
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

  // Same workspace may share an origin; another workspace still blocks the claim.
  const takenByOther = await findOriginTakenOutsideWorkspace(origin, {
    agentId,
    workspaceId: agent.workspaceId,
  });
  if (takenByOther && agent.siteKnowledgeOrigin !== origin) {
    return {
      queued: false,
      reason: "origin_taken",
      takenByAgentId: takenByOther.id,
      takenByAgentName: takenByOther.name || null,
    };
  }

  try {
    if (force || (!hasWeb && agent.siteKnowledgeOrigin !== origin)) {
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
  } catch (error) {
    if (error?.code === "P2002") {
      return { queued: false, reason: "origin_taken" };
    }
    throw error;
  }

  const job = await prisma.siteCrawlJob.create({
    data: {
      agentId,
      origin,
      status: "QUEUED",
      requestId: requestId || null,
    },
  });

  const seeded = [];
  const seeds =
    startUrlList.length > 0
      ? startUrlList
      : pathPrefix === "/docs"
        ? [`${origin}/docs`]
        : [];
  for (const raw of seeds) {
    try {
      const start = new URL(raw);
      if (start.origin !== origin) continue;
      const path = start.pathname || "/";
      if (pathPrefix === "/docs" && !isAideDocsPath(path)) continue;
      const startUrl =
        path === "/" ? `${origin}/` : `${origin}${path.replace(/\/+$/, "")}`;
      if (seeded.includes(startUrl)) continue;
      seeded.push(startUrl);
      if (startUrl === `${origin}/`) continue;
      await prisma.siteCrawlPage.create({
        data: {
          jobId: job.id,
          url: startUrl,
          canonicalUrl: startUrl,
          status: "DISCOVERED",
          depth: 0,
        },
      });
    } catch {
      // skip invalid seed
    }
  }

  return {
    queued: true,
    jobId: job.id,
    origin,
    startUrl: seeded[0] || null,
    startUrls: seeded,
    pathPrefix: pathPrefix || null,
    requestId: job.requestId,
    recrawl: recrawlDue,
    force,
  };
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
  const startedMs = Date.now();
  logCrawlEvent("crawl_started", {
    crawlId: jobId,
    agentId: job.agentId,
    origin: job.origin,
    requestId,
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
    let { origin, pages, coverage = {} } = await crawlPublicOrigin(job.origin, {
      resumeUrls: resumePages,
      pathPrefix:
        resumePages.length &&
        resumePages.every((p) => {
          try {
            return isAideDocsPath(new URL(p.url || p.canonicalUrl).pathname);
          } catch {
            return false;
          }
        })
          ? "/docs"
          : null,
      onDiscovered: (page) => persistPage({ ...page, status: "DISCOVERED" }),
      onPage: persistPage,
    });

    const spaSeeds = Array.isArray(coverage.spaShellUrls) ? coverage.spaShellUrls : [];
    if (coverage.needsBrowserRender === true && spaSeeds.length) {
      if (isCrawlBrowserEnabled()) {
        const seedUrls = [
          ...resumePages.map((p) => p.url || p.canonicalUrl).filter(Boolean),
          ...spaSeeds,
          `${origin}/`,
        ];
        const browserResult = await crawlPublicOriginBrowser(origin, {
          seedUrls,
          onDiscovered: (page) => persistPage({ ...page, status: "DISCOVERED" }),
          onPage: persistPage,
        });
        const seenHash = new Set(pages.map((p) => p.contentHash).filter(Boolean));
        for (const page of browserResult.pages || []) {
          if (page.contentHash && seenHash.has(page.contentHash)) continue;
          if (page.contentHash) seenHash.add(page.contentHash);
          pages.push(page);
        }
        coverage = {
          ...coverage,
          ...browserResult.coverage,
          renderFallbackUsed: true,
          needsBrowserRender: true,
          indexed: pages.length,
        };
        origin = browserResult.origin || origin;
      } else if (!pages.length) {
        throw new Error(
          "This site loads some pages using JavaScript. Aide couldn't read those pages with the standard crawler. Retry after deploying enhanced rendering, or add key pages as text."
        );
      }
    }

    if (!pages.length) {
      throw new Error(
        coverage.needsBrowserRender
          ? "This site loads some pages using JavaScript. Aide couldn't read those pages."
          : "No public HTML text found. Add help pages as text, or crawl a site that publishes HTML."
      );
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
          skippedCount: Number(coverage.privateSkipped || 0) + Number(coverage.nonHtmlSkipped || 0) + Number(coverage.robotsBlocked || 0) + Number(coverage.qualitySkipped || 0) + Number(coverage.contentDuplicates || 0),
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
    logCrawlEvent("crawl_completed", {
      crawlId: jobId,
      agentId: job.agentId,
      origin,
      requestId,
      status: partial ? "PARTIAL" : "DONE",
      pages_discovered: coverage.discovered,
      pages_http_fetched: coverage.fetched,
      pages_indexed: pages.length,
      pages_skipped: Number(coverage.spaShellSkipped || 0) + Number(coverage.qualitySkipped || 0),
      pages_duplicate: coverage.contentDuplicates,
      pages_failed: coverage.failed,
      sitemap_urls: coverage.sitemapUrls,
      render_fallback_used: coverage.renderFallbackUsed === true,
      duration_ms: Date.now() - startedMs,
    });
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
    logCrawlEvent("crawl_failed", {
      crawlId: jobId,
      agentId: job?.agentId,
      origin: job?.origin,
      requestId,
      status: "FAILED",
      reason: "CRAWL_FAILED",
      duration_ms: Date.now() - startedMs,
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

/**
 * Queue recrawls that are due without waiting for a widget ping.
 */
export async function enqueueDueSiteRecrawls({ requestId = null } = {}) {
  const agents = await prisma.agent.findMany({
    where: {
      crawlRecrawlHours: { gt: 0 },
      siteKnowledgeOrigin: { not: null },
    },
    select: {
      id: true,
      crawlRecrawlHours: true,
      siteCrawledAt: true,
      siteKnowledgeOrigin: true,
    },
    take: 200,
  });
  let queued = 0;
  for (const agent of agents) {
    if (!isRecrawlDue(agent)) continue;
    const result = await enqueueOneTimeCrawl(agent.id, agent.siteKnowledgeOrigin, {
      requestId,
      force: true,
    });
    if (result?.queued) queued += 1;
  }
  return { ok: true, queued, scanned: agents.length };
}
