import { v2 as cloudinary } from "cloudinary";

let configured = false;

export function getCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloud_name || !api_key || !api_secret) {
    const err = new Error("Cloudinary is not configured");
    err.status = 500;
    err.details = {
      cloudinary:
        "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env",
    };
    throw err;
  }

  if (!configured) {
    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

export function getCloudinaryFolder() {
  return process.env.CLOUDINARY_FOLDER?.trim() || "hapy/knowledge";
}
