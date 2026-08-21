import { Readable } from "node:stream";
import { getCloudinary, getCloudinaryFolder } from "@/lib/cloudinary";
import {
  buildAttachmentMessage,
  CHAT_UPLOAD_MAX_BYTES,
  formatChatUploadLimit,
} from "@/lib/utils/chat-attachments";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

const IMAGE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function mimeLooksPdf(mimeType, name) {
  return (
    mimeType === "application/pdf" ||
    String(name || "").toLowerCase().endsWith(".pdf")
  );
}

/**
 * @returns {Promise<{ fileUrl: string, publicId: string, kind: "image" | "file", name: string }>}
 */
export async function uploadChatAttachment(buffer, { fileName, mimeType } = {}) {
  if (!buffer?.length) {
    throw httpError(400, "Validation failed", { file: "File is required" });
  }
  if (buffer.length > CHAT_UPLOAD_MAX_BYTES) {
    throw httpError(400, "Validation failed", {
      file: `File must be ${formatChatUploadLimit()} or smaller`,
    });
  }

  const name = String(fileName || "attachment").slice(0, 80);
  const isImage = IMAGE.has(mimeType);
  const cloudinary = getCloudinary();
  const folder = `${getCloudinaryFolder()}/chat`;
  const safe = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const publicId = `${folder}/${Date.now()}-${safe || "file"}`;

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: isImage ? "image" : "auto",
          public_id: publicId,
          overwrite: false,
        },
        (error, uploadResult) => {
          if (error) reject(error);
          else resolve(uploadResult);
        }
      );
      Readable.from(buffer).pipe(stream);
    });

    const fileUrl = result?.secure_url || result?.url;
    const id = result?.public_id;
    if (!fileUrl || !id) {
      throw httpError(502, "Upload failed", {
        cloudinary: "Missing URL from Cloudinary response",
      });
    }

    return {
      fileUrl,
      publicId: id,
      kind: isImage ? "image" : mimeLooksPdf(mimeType, name) ? "pdf" : "file",
      name,
    };
  } catch (error) {
    if (error.status) throw error;
    console.error("Chat attachment upload failed", error?.message || error);
    throw httpError(502, "Upload failed", {
      cloudinary: "Could not upload the file",
    });
  }
}

export function attachmentMessage(payload) {
  return buildAttachmentMessage(payload);
}
