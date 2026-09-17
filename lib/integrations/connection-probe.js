/**
 * Generic connection verification status (control-plane).
 * Pack install never sets verified — only an explicit probe does.
 */

export const CONNECTION_VERIFICATION = Object.freeze({
  UNVERIFIED: "unverified",
  VERIFIED: "verified",
});

/**
 * @param {{ healthVerifiedAt?: string|Date|null }|null|undefined} revision
 */
export function connectionVerificationStatus(revision) {
  return revision?.healthVerifiedAt
    ? CONNECTION_VERIFICATION.VERIFIED
    : CONNECTION_VERIFICATION.UNVERIFIED;
}

export function connectionVerificationLabel(status) {
  if (status === CONNECTION_VERIFICATION.VERIFIED) return "Verified";
  return "Not verified";
}

/**
 * Probe URL for a connection base origin (never from LLM prose).
 * @param {string} baseOrigin
 * @param {string} [path]
 */
export function buildConnectionProbeUrl(baseOrigin, path = "/") {
  const origin = String(baseOrigin || "").replace(/\/$/, "");
  if (!origin) {
    const err = new Error("Connection base origin is required");
    err.status = 400;
    err.code = "CONNECTION_ORIGIN_REQUIRED";
    throw err;
  }
  const p = path && path !== "/" ? (path.startsWith("/") ? path : `/${path}`) : "/";
  return `${origin}${p === "/" ? "/" : p}`;
}

/**
 * Whether an HTTP probe response counts as verified host reachability.
 * 2xx–4xx means we reached the origin (5xx / null = fail).
 */
export function isProbeHttpSuccess(httpStatus) {
  const n = Number(httpStatus);
  return Number.isFinite(n) && n >= 200 && n < 500;
}
