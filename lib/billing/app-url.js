/** Absolute app origin from env (production / emails / fallbacks). */
export function getAppBaseUrl() {
  const raw =
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function isLocalHost(host) {
  if (!host) return true;
  const hostname = host.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Public origin from the incoming HTTP request (ngrok, Vercel preview, prod).
 * Returns null when the request looks like plain localhost.
 */
export function originFromRequest(request) {
  if (!request?.headers) return null;

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();
  const host = forwardedHost || hostHeader;

  if (!host || isLocalHost(host)) return null;

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.includes("ngrok") ? "https" : "http");

  return `${proto}://${host}`.replace(/\/$/, "");
}

/**
 * SafePay redirect/cancel URLs — prefer tunnel/prod host over localhost in .env.
 * Dev rule: keep AUTH_URL=localhost; open the app via ngrok in the browser.
 */
export function getRequestAppBaseUrl(request) {
  return originFromRequest(request) || getAppBaseUrl();
}
