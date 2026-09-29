import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";
import { enqueueOneTimeCrawl } from "@/lib/services/embed.service";
import { parseOwnerCrawlStartUrl, parseOwnerCrawlUrlList } from "@/lib/services/site-crawler";
import {
  deleteCloudinaryAsset,
  uploadPdfBuffer,
} from "@/lib/utils/cloudinary-pdf";

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

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  err.code = details.code;
  return err;
}

export async function listKnowledgeForAgent(agentId, userId) {
  const agent = await getAgentForUser(agentId, userId);

  const [owned, sharedRows] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.knowledgeDocumentShare.findMany({
      where: { consumerAgentId: agentId },
      include: {
        document: {
          include: {
            agent: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const ownedMapped = owned.map((doc) => ({
    ...doc,
    isShared: false,
    sharedFromAgentId: null,
    sharedFromAgentName: null,
  }));

  const sharedMapped = sharedRows
    .filter((row) => row.document && row.document.agentId !== agent.id)
    .map((row) => ({
      ...row.document,
      isShared: true,
      sharedFromAgentId: row.document.agent?.id || row.document.agentId,
      sharedFromAgentName: row.document.agent?.name || "Agent",
    }));

  // Drop nested agent from serialized payload
  return [...ownedMapped, ...sharedMapped].map((doc) => {
    const { agent: _agent, ...rest } = doc;
    return rest;
  });
}

/**
 * Own documents + documents shared into this agent (live rows, not copies).
 * @param {string} agentId
 * @param {{ select?: object }} [opts]
 */
export async function loadKnowledgeDocsForRetrieval(agentId, opts = {}) {
  const select = opts.select || {
    id: true,
    name: true,
    type: true,
    content: true,
    origin: true,
    sourceUrl: true,
    createdAt: true,
    agentId: true,
  };
  return prisma.knowledgeDocument.findMany({
    where: {
      OR: [
        { agentId },
        { shares: { some: { consumerAgentId: agentId } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select,
  });
}

/**
 * Share dialog: sibling agents + which already receive this document.
 */
export async function listDocumentShares(documentId, userId) {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: { agent: true },
  });
  if (!document) {
    throw httpError(404, "Knowledge document not found");
  }

  await getAgentForUser(document.agentId, userId);

  const [shares, siblings] = await Promise.all([
    prisma.knowledgeDocumentShare.findMany({
      where: { documentId },
      select: {
        consumerAgentId: true,
        createdAt: true,
        consumer: { select: { id: true, name: true } },
      },
    }),
    prisma.agent.findMany({
      where: {
        workspaceId: document.agent.workspaceId,
        NOT: { id: document.agentId },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    documentId,
    documentName: document.name,
    shares: shares.map((row) => ({
      consumerAgentId: row.consumerAgentId,
      consumerAgentName: row.consumer?.name || "Agent",
      createdAt: row.createdAt,
    })),
    eligibleAgents: siblings.map((row) => ({
      id: row.id,
      name: row.name,
    })),
  };
}

/**
 * Replace which same-workspace agents receive this document (live reference).
 */
export async function setDocumentShares(documentId, userId, consumerAgentIds) {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: { agent: true },
  });
  if (!document) {
    throw httpError(404, "Knowledge document not found");
  }

  await getAgentForUser(document.agentId, userId, { mutate: true });

  const requested = [
    ...new Set(
      (Array.isArray(consumerAgentIds) ? consumerAgentIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];

  if (requested.includes(document.agentId)) {
    throw httpError(400, "Cannot share a document to its owning agent", {
      code: "KNOWLEDGE_SHARE_SELF",
    });
  }

  if (requested.length) {
    const consumers = await prisma.agent.findMany({
      where: {
        id: { in: requested },
        workspaceId: document.agent.workspaceId,
      },
      select: { id: true },
    });
    if (consumers.length !== requested.length) {
      throw httpError(
        400,
        "Knowledge can only be shared with agents in this workspace",
        { code: "KNOWLEDGE_SHARE_WORKSPACE" }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocumentShare.deleteMany({ where: { documentId } });
    if (requested.length) {
      await tx.knowledgeDocumentShare.createMany({
        data: requested.map((consumerAgentId) => ({
          documentId,
          consumerAgentId,
        })),
      });
    }
  });

  return listDocumentShares(documentId, userId);
}

/**
 * Consumer removes a shared document from their knowledge list (unlink only).
 */
export async function unshareDocumentForConsumer(documentId, consumerAgentId, userId) {
  await getAgentForUser(consumerAgentId, userId, { mutate: true });
  const existing = await prisma.knowledgeDocumentShare.findUnique({
    where: {
      documentId_consumerAgentId: { documentId, consumerAgentId },
    },
  });
  if (!existing) {
    throw httpError(404, "Shared knowledge not found");
  }
  await prisma.knowledgeDocumentShare.delete({
    where: { id: existing.id },
  });
}

export async function getLatestCrawlJob(agentId, userId) {
  await getAgentForUser(agentId, userId);
  return prisma.siteCrawlJob.findFirst({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      error: true,
      origin: true,
      finishedAt: true,
    },
  });
}

/**
 * Owner dashboard crawl / re-crawl.
 * Optional homepageUrl or urls[] seeds public https pages (same origin).
 * Auth / private paths are skipped.
 */
export async function retrySiteCrawlForAgent(agentId, userId, options = {}) {
  const agent = await getAgentForUser(agentId, userId);
  const latest = await prisma.siteCrawlJob.findFirst({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, origin: true },
  });

  if (latest && (latest.status === "QUEUED" || latest.status === "RUNNING")) {
    throw httpError(409, "A website crawl is already in progress", {
      code: "CRAWL_IN_FLIGHT",
      jobId: latest.id,
    });
  }

  const urlListRaw = Array.isArray(options.urls)
    ? options.urls
    : options.homepageUrl || options.origin || "";
  let origin =
    String(agent.siteKnowledgeOrigin || "").trim() ||
    String(latest?.origin || "").trim() ||
    "";
  let startUrls = [];

  const hasUrlInput =
    (Array.isArray(urlListRaw) && urlListRaw.length > 0) ||
    String(urlListRaw || "").trim();

  if (hasUrlInput) {
    const parsed = parseOwnerCrawlUrlList(urlListRaw, appOrigin());
    if (parsed.skip) {
      const reason = parsed.reason || "invalid";
      if (reason === "too-many" || reason === "mixed-origin") {
        throw httpError(400, parsed.message || "Invalid crawl URL list", {
          code: "CRAWL_URLS_INVALID",
          reason,
        });
      }
      if (reason === "auth-path" || reason === "auth-query") {
        throw httpError(
          400,
          "Use public page URLs — login, account, and admin paths are not crawled",
          { code: "CRAWL_ORIGIN_UNSAFE", reason }
        );
      }
      if (reason === "localhost") {
        throw httpError(
          400,
          "Localhost cannot be crawled. Use a public https URL (e.g. your Vercel production domain).",
          { code: "CRAWL_ORIGIN_UNSAFE", reason }
        );
      }
      if (reason === "own-product" || reason === "aide-origin") {
        throw httpError(
          400,
          parsed.message ||
            "Cannot crawl the Aide app itself. Use your website URL, or Aide Docs at /docs (for example https://YOUR-HOST/docs).",
          { code: "CRAWL_ORIGIN_UNSAFE", reason }
        );
      }
      throw httpError(
        400,
        parsed.message || "Enter public https page URLs for your site",
        { code: "CRAWL_ORIGIN_UNSAFE", reason }
      );
    }
    origin = parsed.origin;
    startUrls = parsed.startUrls;
  } else if (origin) {
    const single = parseOwnerCrawlStartUrl(origin, appOrigin());
    if (!single.skip) startUrls = [single.startUrl];
  }

  if (!origin) {
    throw httpError(
      400,
      "Enter one or more public https page URLs (one per line) to crawl.",
      { code: "CRAWL_ORIGIN_MISSING" }
    );
  }

  const result = await enqueueOneTimeCrawl(agentId, origin, {
    force: true,
    requestId: options.requestId || null,
    startUrls,
  });

  if (!result.queued) {
    const reason = result.reason || "not_queued";
    if (reason === "in-flight") {
      throw httpError(409, "A website crawl is already in progress", {
        code: "CRAWL_IN_FLIGHT",
        jobId: result.jobId,
      });
    }
    if (reason === "locked-other-origin") {
      throw httpError(
        409,
        "Website knowledge is locked to another origin. Delete website knowledge first to crawl a different site.",
        { code: "CRAWL_ORIGIN_LOCKED" }
      );
    }
    if (reason === "origin_taken") {
      const other = result.takenByAgentName
        ? ` (${result.takenByAgentName})`
        : "";
      throw httpError(
        409,
        `This website is already linked to an agent in another workspace${other}. Use a different site URL, or clear that workspace's site lock first.`,
        {
          code: "CRAWL_ORIGIN_TAKEN",
          takenByAgentId: result.takenByAgentId || null,
        }
      );
    }
    if (
      reason === "aide-origin" ||
      reason === "own-product" ||
      reason === "localhost" ||
      reason === "not-https" ||
      reason === "invalid" ||
      reason === "missing" ||
      reason === "auth-path" ||
      reason === "auth-query"
    ) {
      throw httpError(
        400,
        reason === "own-product" || reason === "aide-origin"
          ? "Cannot crawl the Aide app itself. Use your website URL, or Aide Docs at /docs."
          : "Crawl origin must be your public https site (not localhost)",
        { code: "CRAWL_ORIGIN_UNSAFE", reason }
      );
    }
    throw httpError(400, "Unable to queue website crawl", {
      code: "CRAWL_NOT_QUEUED",
      reason,
    });
  }

  return {
    queued: true,
    jobId: result.jobId,
    origin: result.origin,
    startUrl: result.startUrl || startUrls[0] || null,
    startUrls: result.startUrls || startUrls,
    latestCrawl: {
      id: result.jobId,
      status: "QUEUED",
      error: null,
      origin: result.origin,
      finishedAt: null,
    },
  };
}

export async function createTextKnowledge(agentId, userId, data) {
  await getAgentForUser(agentId, userId);

  return prisma.knowledgeDocument.create({
    data: {
      agentId,
      name: data.name,
      type: "TEXT",
      content: data.content,
    },
  });
}

export async function createPdfKnowledge(agentId, userId, { file, name }) {
  await getAgentForUser(agentId, userId);

  if (!file) {
    throw httpError(400, "Validation failed", { file: "PDF file is required" });
  }

  const fileName = file.name || "document.pdf";
  const mime = file.type || "";
  const isPdfMime =
    mime === "application/pdf" || mime === "application/x-pdf";
  const isPdfName = fileName.toLowerCase().endsWith(".pdf");

  if (!isPdfMime && !isPdfName) {
    throw httpError(400, "Validation failed", {
      file: "Only PDF files are allowed",
    });
  }

  if (typeof file.size === "number" && file.size > MAX_PDF_BYTES) {
    throw httpError(400, "Validation failed", {
      file: "PDF must be 10MB or smaller",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length > MAX_PDF_BYTES) {
    throw httpError(400, "Validation failed", {
      file: "PDF must be 10MB or smaller",
    });
  }

  // Upload to Cloudinary first — binary never stored in DB
  const uploaded = await uploadPdfBuffer(buffer, { fileName });

  let text;
  try {
    const { extractTextFromPdf } = await import("@/lib/utils/pdf");
    text = await extractTextFromPdf(buffer);
  } catch (error) {
    console.error("PDF extract failed", error);
    try {
      await deleteCloudinaryAsset(uploaded.publicId);
    } catch (cleanupError) {
      console.error("Cloudinary cleanup after extract failure", cleanupError);
    }
    throw httpError(400, "Could not extract text from PDF", {
      file: "Invalid or unreadable PDF",
      reason: error?.message || "extract failed",
    });
  }

  if (!text) {
    try {
      await deleteCloudinaryAsset(uploaded.publicId);
    } catch (cleanupError) {
      console.error("Cloudinary cleanup after empty extract", cleanupError);
    }
    throw httpError(400, "Could not extract text from PDF", {
      file: "No text found in PDF",
    });
  }

  const displayName = (name && String(name).trim()) || fileName;

  return prisma.knowledgeDocument.create({
    data: {
      agentId,
      name: displayName,
      type: "PDF",
      content: text,
      fileUrl: uploaded.fileUrl,
      cloudinaryPublicId: uploaded.publicId,
    },
  });
}

export async function deleteKnowledgeForUser(documentId, userId) {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: { agent: true },
  });

  if (!document) {
    throw httpError(404, "Knowledge document not found");
  }

  if (document.agent.userId !== userId) {
    throw httpError(403, "Not allowed to access this knowledge document");
  }

  if (document.type === "PDF" && document.cloudinaryPublicId) {
    await deleteCloudinaryAsset(document.cloudinaryPublicId);
  }

  await prisma.knowledgeDocument.delete({
    where: { id: documentId },
  });
}
