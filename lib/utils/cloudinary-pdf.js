import { Readable } from "node:stream";
import { getCloudinary, getCloudinaryFolder } from "@/lib/cloudinary";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function safeBaseName(fileName) {
  const base = String(fileName || "document")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "document";
}

/**
 * Upload a PDF buffer to Cloudinary as a raw asset.
 * @returns {Promise<{ fileUrl: string, publicId: string }>}
 */
export async function uploadPdfBuffer(buffer, { fileName } = {}) {
  const cloudinary = getCloudinary();
  const folder = getCloudinaryFolder();
  const publicId = `${folder}/${Date.now()}-${safeBaseName(fileName)}`;

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: publicId,
          format: "pdf",
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

    return { fileUrl, publicId: id };
  } catch (error) {
    if (error.status) throw error;
    console.error("Cloudinary PDF upload failed", error?.message || error);
    throw httpError(502, "Upload failed", {
      cloudinary: "Could not upload PDF to Cloudinary",
    });
  }
}

/**
 * Delete a raw Cloudinary asset by public_id.
 */
export async function deleteCloudinaryAsset(publicId) {
  if (!publicId) return;

  const cloudinary = getCloudinary();

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
      invalidate: true,
    });
  } catch (error) {
    console.error("Cloudinary destroy failed", error?.message || error);
    throw httpError(502, "Could not delete file from Cloudinary", {
      cloudinary: publicId,
    });
  }
}
