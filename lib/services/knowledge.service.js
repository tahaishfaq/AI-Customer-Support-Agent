import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";
import { extractTextFromPdf } from "@/lib/utils/pdf";
import {
  deleteCloudinaryAsset,
  uploadPdfBuffer,
} from "@/lib/utils/cloudinary-pdf";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

export async function listKnowledgeForAgent(agentId, userId) {
  await getAgentForUser(agentId, userId);

  return prisma.knowledgeDocument.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });
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
