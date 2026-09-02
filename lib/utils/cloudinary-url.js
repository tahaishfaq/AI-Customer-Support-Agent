/**
 * Cloudinary delivery URL helpers — keep display payloads small (F04-E).
 * Upload already crops to 256×256; display can request even smaller.
 */

/**
 * @param {string | null | undefined} url
 * @param {{ width?: number, height?: number }} [opts]
 * @returns {string | null | undefined}
 */
export function sizedCloudinaryUrl(url, { width = 64, height = 64 } = {}) {
  if (!url || typeof url !== "string") return url;
  if (!/res\.cloudinary\.com\//.test(url) && !/\/image\/upload\//.test(url)) {
    return url;
  }
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const after = url.slice(i + marker.length);
  // Already has a transform chain (starts with letters/underscores before next /).
  if (/^[a-z0-9_,]+\//i.test(after) && !/^v\d+\//.test(after)) {
    return url;
  }
  const w = Math.max(16, Math.min(512, Math.round(width)));
  const h = Math.max(16, Math.min(512, Math.round(height)));
  return `${url.slice(0, i + marker.length)}f_auto,q_auto,w_${w},h_${h},c_fill/${after}`;
}
