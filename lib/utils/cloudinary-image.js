import { Readable } from "node:stream";
import { getCloudinary, getCloudinaryFolder } from "@/lib/cloudinary";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * Upload an image buffer to Cloudinary (avatars / launcher icons).
 * @returns {Promise<{ fileUrl: string, publicId: string }>}
 */
export async function uploadImageBuffer(buffer, { fileName, mimeType } = {}) {
  if (mimeType && !ALLOWED.has(mimeType)) {
    throw httpError(400, "Validation failed", {
      file: "Use a JPG, PNG, WebP, or GIF image",
    });
  }

  const cloudinary = getCloudinary();
  const folder = `${getCloudinaryFolder()}/avatars`;
  const safe = String(fileName || "avatar")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const publicId = `${folder}/${Date.now()}-${safe || "avatar"}`;

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          public_id: publicId,
          overwrite: false,
          transformation: [
            { width: 256, height: 256, crop: "fill", gravity: "face" },
          ],
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
    console.error("Cloudinary image upload failed", error?.message || error);
    throw httpError(502, "Upload failed", {
      cloudinary: "Could not upload image to Cloudinary",
    });
  }
}
