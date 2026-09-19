import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";
import { enqueueOneTimeCrawl } from "@/lib/services/embed.service";
import { parseOwnerCrawlStartUrl } from "@/lib/services/site-crawler";
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
  await getAgentForUser(agentId, userId);

  return prisma.knowledgeDocument.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
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
 * Owner dashboard retry after FAILED (or when origin is known).
 * Optional homepageUrl lets the owner point at a public https site when
 * auto-discovery found no indexable pages. Auth / private paths are skipped.
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

  const homepageRaw = String(options.homepageUrl || "").trim();
  let origin =
    String(agent.siteKnowledgeOrigin || "").trim() ||
    String(latest?.origin || "").trim() ||
    "";
  let startUrl = null;

  if (homepageRaw) {
    const parsed = parseOwnerCrawlStartUrl(homepageRaw, appOrigin());
    if (parsed.skip) {
      const reason = parsed.reason || "invalid";
      if (reason === "auth-path" || reason === "auth-query") {
        throw httpError(
          400,
          "Use a public homepage URL — login, account, and admin paths are not crawled",
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
      throw httpError(
        400,
        "Enter a public https homepage URL for your site",
        { code: "CRAWL_ORIGIN_UNSAFE", reason }
      );
    }
    origin = parsed.origin;
    startUrl = parsed.startUrl;
  }

  if (!origin) {
    throw httpError(
      400,
      "Enter your site homepage URL (https://yoursite.com) to crawl public pages.",
      { code: "CRAWL_ORIGIN_MISSING" }
    );
  }

  const result = await enqueueOneTimeCrawl(agentId, origin, {
    force: true,
    requestId: options.requestId || null,
    startUrl,
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
        "Crawl origin must be your public https site (not the Aide app URL or localhost)",
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
    startUrl: result.startUrl || startUrl || null,
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
