/**
 * Extract and normalize frozen host from a URL template (before {{args}} resolve).
 */
export function extractFrozenHost(urlTemplate) {
  try {
    const withPlaceholder = String(urlTemplate || "").replace(
      /\{\{[^}]+\}\}/g,
      "x"
    );
    const u = new URL(withPlaceholder);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function assertFrozenHostMatch(urlString, frozenHost) {
  if (!frozenHost) return;
  let host;
  try {
    host = new URL(urlString).hostname.toLowerCase();
  } catch {
    const err = new Error("Invalid URL");
    err.status = 400;
    err.code = "SSRF_BLOCKED";
    throw err;
  }
  if (host !== String(frozenHost).toLowerCase()) {
    const err = new Error("URL host does not match frozen host");
    err.status = 400;
    err.code = "SSRF_BLOCKED";
    throw err;
  }
}
