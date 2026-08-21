/**
 * Prefer browser Origin, then Referer. Client body/query origins are not trusted.
 * @param {Request | { headers?: Headers } | null | undefined} request
 * @returns {string} normalized origin or ""
 */
export function originFromRequest(request) {
  if (!request?.headers?.get) return "";
  return originFromHeaderValues({
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
  });
}

/**
 * @param {{ origin?: string | null, referer?: string | null }} headers
 * @returns {string}
 */
export function originFromHeaderValues({ origin, referer } = {}) {
  for (const raw of [origin, referer]) {
    if (!raw) continue;
    try {
      return new URL(raw).origin;
    } catch {
      // ignore
    }
  }
  return "";
}
