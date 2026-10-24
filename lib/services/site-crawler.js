import { chatCompletion } from "@/lib/services/ai/llm.provider";
import dns from "node:dns/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import ipaddr from "ipaddr.js";
import { pinnedFetch, pickPinnedAddress } from "@/lib/actions/pinned-fetch";
import {
  lookLikePrivatePage,
  redactPublicText,
} from "@/lib/services/site-redact";
import {
  crawlOriginsCompatible,
  stripWwwHost,
} from "@/lib/utils/origin-host";

export { crawlOriginsCompatible, stripWwwHost };

const MAX_PAGES = 100;
const MAX_HOPS = 4;
const MAX_SITEMAPS = 8;
const MAX_SITEMAP_URLS = 500;
const MAX_HTML_BYTES = 150_000;
const MAX_SITEMAP_COMPRESSED_BYTES = 150_000;
const MAX_SITEMAP_PLAIN_BYTES = 500_000;
const FETCH_MS = 8_000;
const MAX_REDIRECTS = 4;
const HTTP_FETCH_CONCURRENCY = 3;
const USER_AGENT = "AideBot/1.0 (+https://aide.app/bot)";

const SKIP_PATH =
  /(^|\/)(admin|login|signin|sign-in|signup|sign-up|account|dashboard|wp-admin|api|cart|checkout)(\/|$)|\/\.git|\.env/i;

const SKIP_QUERY = /(^|[?&])(token|session|key|auth|password)=/i;
const ALLOWED_QUERY_KEYS = new Set(["page", "p", "offset", "locale", "lang"]);

const HINT =
  /help|support|faq|docs|documentation|pricing|price|about|contact|shipping|delivery|returns|refund|warranty|privacy|terms|policy|how-to|getting-started/i;

const SKIP_EXT =
  /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|json|xml|pdf|zip|mp4|mp3|woff2?|ttf)(\?|$)/i;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function isPublicAddress(rawAddress) {
  try {
    const address = ipaddr.parse(rawAddress);
    if (address.kind() === "ipv4") {
      const octets = address.octets;
      const first = octets[0];
      const second = octets[1];
      return !(
        first === 0 ||
        first === 10 ||
        first === 127 ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 0) ||
        (first === 192 && second === 168) ||
        (first === 198 && (second === 18 || second === 19)) ||
        first >= 224
      );
    }
    return !address.range() || address.range() === "unicast";
  } catch {
    return false;
  }
}

async function assertSafeFetchUrl(rawUrl, { allowedOrigin } = {}) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw httpError(400, "Invalid crawl URL", { code: "CRAWL_URL_INVALID" });
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw httpError(400, "Crawl URL must use public HTTPS", { code: "CRAWL_URL_UNSAFE" });
  }
  if (url.port && url.port !== "443") {
    throw httpError(400, "Crawl URL uses an unsupported port", { code: "CRAWL_PORT_UNSAFE" });
  }
  if (allowedOrigin && !crawlOriginsCompatible(url.origin, allowedOrigin)) {
    throw httpError(400, "Crawl redirect left the approved origin", { code: "CRAWL_REDIRECT_ORIGIN" });
  }

  const hostname = url.hostname.toLowerCase();
  if (ipaddr.isValid(hostname)) {
    if (!isPublicAddress(hostname)) {
      throw httpError(400, "Crawl destination is not public", { code: "CRAWL_PRIVATE_NETWORK" });
    }
    return { url, addresses: [hostname] };
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw httpError(400, "Crawl hostname could not be resolved", { code: "CRAWL_DNS_FAILED" });
  }
  const list = (addresses || []).map(({ address }) => String(address || "").toLowerCase());
  if (!list.length || list.some((address) => !isPublicAddress(address))) {
    throw httpError(400, "Crawl destination is not public", { code: "CRAWL_PRIVATE_NETWORK" });
  }
  return { url, addresses: list };
}

async function fetchPinned(urlObj, { timeoutMs = FETCH_MS, maxBytes = MAX_HTML_BYTES, allowedOrigin, accept } = {}) {
  const pin = await assertSafeFetchUrl(urlObj, { allowedOrigin });
  const pinned = pickPinnedAddress(pin.addresses);
  if (!pinned) {
    throw httpError(400, "Crawl destination is not public", { code: "CRAWL_PRIVATE_NETWORK" });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = pin.url;
    let currentAddresses = pin.addresses;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const res = await pinnedFetch(
        current.toString(),
        {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": USER_AGENT,
          },
        },
        { hostname: current.hostname.toLowerCase(), addresses: currentAddresses }
      );
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) {
          throw httpError(400, "Crawl redirect limit exceeded", { code: "CRAWL_REDIRECT_LIMIT" });
        }
        const next = await assertSafeFetchUrl(new URL(location, current), { allowedOrigin });
        current = next.url;
        currentAddresses = next.addresses;
        continue;
      }
      if (!res.ok) return { ok: false, status: res.status, text: "", buffer: null };
      const declaredLength = Number(res.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw httpError(413, "Crawl response is too large", { code: "CRAWL_BODY_LIMIT" });
      }
      const buf = await readBoundedBody(res.body, maxBytes);
      return {
        ok: true,
        status: res.status,
        text: buf.toString("utf8"),
        buffer: buf,
        contentType: res.headers.get("content-type") || "",
        contentEncoding: res.headers.get("content-encoding") || "",
      };
    }
    throw httpError(400, "Crawl redirect limit exceeded", { code: "CRAWL_REDIRECT_LIMIT" });
  } catch (error) {
    if (error?.status) throw error;
    return { ok: false, status: 0, text: "", buffer: null };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, { timeoutMs = FETCH_MS, maxBytes = MAX_HTML_BYTES, allowedOrigin } = {}) {
  const result = await fetchPinned(url, { timeoutMs, maxBytes, allowedOrigin });
  return { ok: result.ok, status: result.status, text: result.text || "", contentType: result.contentType || "" };
}

function maybeGunzipSitemap(result, sitemapUrl) {
  const looksGz =
    /\.xml\.gz$/i.test(String(sitemapUrl || "")) ||
    /gzip/i.test(result.contentEncoding || "") ||
    (result.buffer && result.buffer.length >= 2 && result.buffer[0] === 0x1f && result.buffer[1] === 0x8b);
  if (!looksGz || !result.buffer) return result.text || "";
  if (result.buffer.length > MAX_SITEMAP_COMPRESSED_BYTES) {
    throw httpError(413, "Crawl response is too large", { code: "CRAWL_BODY_LIMIT" });
  }
  let inflated;
  try {
    inflated = gunzipSync(result.buffer);
  } catch {
    return "";
  }
  if (inflated.length > MAX_SITEMAP_PLAIN_BYTES) {
    throw httpError(413, "Crawl response is too large", { code: "CRAWL_BODY_LIMIT" });
  }
  return inflated.toString("utf8");
}

async function readBoundedBody(body, maxBytes) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* best effort */ }
      throw httpError(413, "Crawl response is too large", { code: "CRAWL_BODY_LIMIT" });
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function parseRobots(text, userAgent = "AideBot") {
  const disallows = [];
  const allows = [];
  const sitemaps = [];
  let applies = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const k = key.trim().toLowerCase();
    if (k === "sitemap") {
      if (value) sitemaps.push(value);
    } else if (k === "user-agent") {
      applies = value === "*" || value.toLowerCase().includes(userAgent.toLowerCase());
    } else if (k === "disallow" && applies) {
      if (value) disallows.push(value);
    } else if (k === "allow" && applies) {
      if (value) allows.push(value);
    }
  }
  return { disallows, allows, sitemaps };
}

function pathMatchesRobotsRule(pathname, rule) {
  const path = String(pathname || "/");
  const r = String(rule || "");
  if (!r) return false;
  if (r === "/") return true;
  if (path === r) return true;
  if (!path.startsWith(r)) return false;
  if (r.endsWith("/")) return true;
  const next = path[r.length];
  return !next || next === "/" || next === "?" || next === "#";
}

function robotsBlocks(disallows, pathname, allows = []) {
  const path = String(pathname || "/");
  // Longest matching Allow wins over Disallow (common robots.txt practice).
  let bestAllow = -1;
  for (const rule of allows) {
    if (pathMatchesRobotsRule(path, rule)) bestAllow = Math.max(bestAllow, rule.length);
  }
  let bestDisallow = -1;
  for (const rule of disallows) {
    if (pathMatchesRobotsRule(path, rule)) bestDisallow = Math.max(bestDisallow, rule.length);
  }
  if (bestDisallow < 0) return false;
  return bestAllow < bestDisallow;
}

function extractLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) =>
    m[1].trim()
  );
}

function extractTitle(html) {
  const m = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

function extractMetaDescription(html) {
  const raw = String(html || "");
  const byName = raw.match(
    /<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i
  );
  if (byName?.[1]) return byName[1].replace(/\s+/g, " ").trim();
  const byContent = raw.match(
    /<meta\b[^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*\bname\s*=\s*["']description["'][^>]*>/i
  );
  return byContent?.[1] ? byContent[1].replace(/\s+/g, " ").trim() : "";
}

/**
 * Detect create-react-app / Vite / empty-root SPA shells where meaningful
 * content only appears after JavaScript runs.
 */
export function looksLikeThinSpaShell(html, bodyText = "") {
  const raw = String(html || "");
  const text = String(bodyText || "").trim();
  if (/create-react-app/i.test(raw) || /create-react-app/i.test(text)) {
    return true;
  }
  if (/You need to enable JavaScript to run this app/i.test(raw)) {
    return true;
  }
  const emptyRoot =
    /<div[^>]*\bid\s*=\s*["']root["'][^>]*>\s*<\/div>/i.test(raw) ||
    /<div[^>]*\bid\s*=\s*["']app["'][^>]*>\s*<\/div>/i.test(raw) ||
    /<div[^>]*\bid\s*=\s*["']__nuxt["'][^>]*>\s*<\/div>/i.test(raw) ||
    /<div[^>]*\bid\s*=\s*["']__next["'][^>]*>\s*<\/div>/i.test(raw);
  if (emptyRoot && text.length < 80) return true;
  const scriptHeavy = (raw.match(/<script\b/gi) || []).length >= 3;
  const hydration =
    /data-reactroot|window\.__NUXT__|data-server-rendered="true"/i.test(raw);
  if (text.length < 40 && scriptHeavy && (emptyRoot || hydration)) return true;
  if (
    emptyRoot &&
    /<script[^>]+src=["'][^"']*\/static\/js\//i.test(raw) &&
    text.length < 200
  ) {
    return true;
  }
  // Already-rendered path: indexed text is only CRA/Vite boilerplate.
  if (
    !raw &&
    text.length > 0 &&
    text.length < 120 &&
    /create-react-app|vite|empty #root/i.test(text)
  ) {
    return true;
  }
  return false;
}

function extractText(html) {
  let text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Preserve meaning-bearing structure before removing the remaining tags.
  // This keeps pricing tables and policy bullets retrievable as separate claims.
  text = text
    .replace(/<\s*(h[1-6])\b[^>]*>/gi, "\n\n")
    .replace(/<\s*\/\s*(h[1-6])\s*>/gi, "\n\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*(tr)\b[^>]*>/gi, "\n")
    .replace(/<\s*\/\s*tr\s*>/gi, "\n")
    .replace(/<\s*(t[hd])\b[^>]*>/gi, " ")
    .replace(/<\s*\/\s*(t[hd])\s*>/gi, " | ")
    .replace(/<\s*(p|div|section|article|br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|section|article)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s*\|\s*$/, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  return text;
}

function extractHrefs(html) {
  return [...String(html || "").matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(
    (m) => m[1].trim()
  );
}

function extractCanonical(html) {
  const match = String(html || "").match(
    /<link\b[^>]*\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i
  );
  return match?.[1]?.trim() || null;
}

export function isHashClientRoute(hash) {
  const h = String(hash || "").trim();
  return /^#\/[A-Za-z0-9._~\-\/]+$/.test(h);
}

export function looksLikeLowQualityPage(title, bodyText) {
  const titleText = String(title || "");
  const text = String(bodyText || "");
  const combined = `${titleText}\n${text}`.toLowerCase();
  if (/page not found|404 not found|\b404\b/.test(combined) && text.length < 500) {
    return "soft_404";
  }
  if (
    /\b(sign in|log in|login|create account)\b/i.test(titleText) &&
    /\bpassword\b/i.test(text) &&
    text.length < 900
  ) {
    return "login_wall";
  }
  if (/\b(we'll be back|under maintenance|temporarily unavailable)\b/i.test(combined) && text.length < 600) {
    return "maintenance";
  }
  if (/\b(enable cookies|cookie consent|accept all cookies)\b/i.test(text) && text.length < 250) {
    return "cookie_wall";
  }
  return null;
}

export function normalizeHttpsOrigin(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1"
    ) {
      return { skip: true, reason: "localhost" };
    }
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
      return { skip: true, reason: "not-https" };
    }
    return { origin: `https://${host}${url.port && url.port !== "443" ? `:${url.port}` : ""}` };
  } catch {
    return null;
  }
}

/** True when pathname is Aide public docs (crawlable on own product origin). */
export function isAideDocsPath(pathname) {
  const path = String(pathname || "/");
  return path === "/docs" || path.startsWith("/docs/");
}

/**
 * @param {string} origin
 * @param {string} [appOrigin]
 * @param {{ allowAideDocs?: boolean }} [options]
 */
export function shouldSkipCrawlOrigin(origin, appOrigin, options = {}) {
  const parsed = normalizeHttpsOrigin(origin);
  if (!parsed || parsed.skip) return { skip: true, reason: parsed?.reason || "invalid" };
  if (appOrigin) {
    try {
      if (new URL(appOrigin).origin === parsed.origin) {
        if (options.allowAideDocs === true) {
          return { skip: false, origin: parsed.origin, pathPrefix: "/docs" };
        }
        return { skip: true, reason: "own-product" };
      }
    } catch {
      // ignore
    }
  }
  return { skip: false, origin: parsed.origin };
}

/**
 * Owner-entered homepage / start URL after a failed crawl.
 * Public HTTPS only (no localhost). Seeds crawl at path when provided.
 * Aide app origin is allowed only for `/docs` paths.
 * @returns {{ skip: true, reason: string, message?: string } | { skip: false, origin: string, startUrl: string, pathPrefix?: string|null }}
 */
export function parseOwnerCrawlStartUrl(raw, appOrigin) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { skip: true, reason: "missing" };
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { skip: true, reason: "invalid" };
  }

  let path = url.pathname || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";

  let sameAsApp = false;
  if (appOrigin) {
    try {
      sameAsApp = new URL(appOrigin).origin === new URL(candidate).origin;
    } catch {
      sameAsApp = false;
    }
  }

  const originCheck = shouldSkipCrawlOrigin(candidate, appOrigin, {
    allowAideDocs: sameAsApp && isAideDocsPath(path),
  });
  if (originCheck.skip) {
    if (originCheck.reason === "own-product") {
      return {
        skip: true,
        reason: "own-product",
        message:
          "Cannot crawl the Aide app itself. Use your website URL, or Aide Docs at /docs (for example https://YOUR-HOST/docs).",
      };
    }
    return { skip: true, reason: originCheck.reason || "invalid" };
  }
  if (SKIP_PATH.test(path) && !isAideDocsPath(path)) {
    return { skip: true, reason: "auth-path" };
  }
  if (SKIP_QUERY.test(url.search || "")) {
    return { skip: true, reason: "auth-query" };
  }
  const startUrl =
    path === "/" ? `${originCheck.origin}/` : `${originCheck.origin}${path}`;
  return {
    skip: false,
    origin: originCheck.origin,
    startUrl,
    pathPrefix: originCheck.pathPrefix || null,
  };
}

const MAX_OWNER_SEED_URLS = 20;

/**
 * Owner multi-URL seed list (one homepage + extra public paths).
 * All URLs must share one public https origin.
 * @returns {{ skip: true, reason: string, message?: string } | { skip: false, origin: string, startUrls: string[] }}
 */
export function parseOwnerCrawlUrlList(raw, appOrigin) {
  const parts = Array.isArray(raw)
    ? raw.map((item) => String(item || "").trim()).filter(Boolean)
    : String(raw || "")
        .split(/[\n,]+/)
        .map((line) => line.trim())
        .filter(Boolean);

  if (!parts.length) return { skip: true, reason: "missing" };
  if (parts.length > MAX_OWNER_SEED_URLS) {
    return {
      skip: true,
      reason: "too-many",
      message: `Enter at most ${MAX_OWNER_SEED_URLS} URLs at a time`,
    };
  }

  const startUrls = [];
  let origin = null;
  let pathPrefix = null;
  for (const part of parts) {
    const parsed = parseOwnerCrawlStartUrl(part, appOrigin);
    if (parsed.skip) {
      return {
        skip: true,
        reason: parsed.reason || "invalid",
        message:
          parsed.message ||
          (parsed.reason === "own-product"
            ? "Cannot crawl the Aide app itself. Use your website URL, or Aide Docs at /docs."
            : `Invalid URL: ${part}`),
      };
    }
    if (!origin) origin = parsed.origin;
    else if (parsed.origin !== origin) {
      return {
        skip: true,
        reason: "mixed-origin",
        message:
          "All URLs must be on the same website (same https origin). Delete website knowledge first to crawl a different site.",
      };
    }
    if (parsed.pathPrefix) pathPrefix = parsed.pathPrefix;
    if (!startUrls.includes(parsed.startUrl)) startUrls.push(parsed.startUrl);
  }

  if (pathPrefix === "/docs") {
    const bad = startUrls.find((u) => {
      try {
        return !isAideDocsPath(new URL(u).pathname);
      } catch {
        return true;
      }
    });
    if (bad) {
      return {
        skip: true,
        reason: "own-product",
        message:
          "On the Aide app host, only /docs pages can be crawled. Remove non-docs URLs.",
      };
    }
  }

  return { skip: false, origin, startUrls, pathPrefix };
}

export function resolveCrawlUrl(href, origin, { allowSitemap = false, pathPrefix = null, allowHashRoutes = false } = {}) {
  return resolveUrl(href, origin, { allowSitemap, pathPrefix, allowHashRoutes });
}

function resolveUrl(href, origin, { allowSitemap = false, pathPrefix = null, allowHashRoutes = false } = {}) {
  const opts = { allowSitemap, pathPrefix, allowHashRoutes };
  try {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return null;
    }
    const url = new URL(href, origin);
    // www ↔ apex: rewrite onto the crawl base origin so same-site links are not dropped.
    if (url.origin !== origin) {
      if (!crawlOriginsCompatible(url.origin, origin)) return null;
      const base = new URL(origin);
      url.protocol = base.protocol;
      url.hostname = base.hostname;
      url.port = base.port;
    }
    if (pathPrefix) {
      const prefix = String(pathPrefix);
      const path = url.pathname || "/";
      if (path !== prefix && !path.startsWith(`${prefix}/`)) return null;
    }
    if (SKIP_EXT.test(url.pathname) && !(allowSitemap && /\.xml(\.gz)?$/i.test(url.pathname))) return null;
    if (SKIP_PATH.test(url.pathname) && !(pathPrefix && isAideDocsPath(url.pathname))) return null;
    if (SKIP_QUERY.test(url.search)) return null;
    if (opts.allowHashRoutes && isHashClientRoute(url.hash)) {
      url.hash = String(url.hash).replace(/#\/+/, "#/").slice(0, 180);
    } else {
      url.hash = "";
    }
    const kept = [];
    for (const [key, value] of url.searchParams.entries()) {
      const normalizedKey = key.toLowerCase();
      if (!ALLOWED_QUERY_KEYS.has(normalizedKey)) continue;
      if (!value || value.length > 40 || !/^[a-z0-9._~-]+$/i.test(value)) return null;
      if ((normalizedKey === "page" || normalizedKey === "p" || normalizedKey === "offset") && Number(value) > 100) return null;
      kept.push([normalizedKey, value]);
    }
    url.search = "";
    for (const [key, value] of kept) url.searchParams.append(key, value);
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

function scoreUrl(url) {
  try {
    const { pathname } = new URL(url);
    if (pathname === "/" || pathname === "") return 100;
    if (HINT.test(pathname)) return 80;
    return 10;
  } catch {
    return 0;
  }
}

async function compileWebsiteDoc(origin, pages) {
  const digest = pages
    .map((p) => `URL: ${p.url}\nTitle: ${p.title}\n${p.text.slice(0, 2500)}`)
    .join("\n\n---\n\n")
    .slice(0, 18_000);

  const system = [
    "You compile a PUBLIC customer-support knowledge base from website page text.",
    "Output Markdown FAQ-style bullets (hours, shipping, pricing, contact, policies).",
    "Use only facts present in the pages. If missing, omit.",
    "Never include API keys, passwords, tokens, connection strings, admin URLs, source code, env vars, or private staff details.",
    "End with a Sources section listing the page URLs.",
    "Do not mention crawling or scraping.",
  ].join(" ");

  try {
    const reply = await chatCompletion({
      system,
      messages: [{ role: "user", content: digest }],
    });
    const content = redactPublicText(reply.content);
    if (content.length > 40) return content;
  } catch {
    // fallback below
  }

  return pages
    .map((p) => `### ${p.title || p.url}\nSource: ${p.url}\n\n${p.text}`)
    .join("\n\n")
    .slice(0, 20_000);
}

/**
 * Fetch public HTML from origin. Returns cleaned pages (may be empty).
 */
export async function crawlPublicOrigin(origin, options = {}) {
  const onDiscovered = options.onDiscovered;
  const onPage = options.onPage;
  const resumeUrls = Array.isArray(options.resumeUrls) ? options.resumeUrls : [];
  let pathPrefix = options.pathPrefix || null;
  if (!pathPrefix && resumeUrls.length) {
    const paths = resumeUrls
      .map((item) => {
        try {
          const url = typeof item === "string" ? item : item?.url;
          return new URL(url).pathname || "/";
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    if (paths.length && paths.every((p) => isAideDocsPath(p))) {
      pathPrefix = "/docs";
    }
  }
  const parsed = shouldSkipCrawlOrigin(origin, null, {
    allowAideDocs: pathPrefix === "/docs",
  });
  // When pathPrefix is /docs, origin may be own product — allow via pathPrefix even if
  // shouldSkip without allowAideDocs would reject. crawlPublicOrigin is called without appOrigin.
  let base;
  if (parsed.skip && pathPrefix === "/docs") {
    const raw = normalizeHttpsOrigin(origin);
    if (!raw || raw.skip) {
      throw httpError(400, "This origin cannot be crawled", { origin: raw?.reason || "invalid" });
    }
    base = raw.origin;
  } else if (parsed.skip) {
    throw httpError(400, "This origin cannot be crawled", { origin: parsed.reason });
  } else {
    base = parsed.origin;
  }
  await assertSafeFetchUrl(base, { allowedOrigin: base });

  const resolveOpts = { pathPrefix };
  const robots = await fetchText(`${base}/robots.txt`, { timeoutMs: 5000, allowedOrigin: base });
  const robotsData = robots.ok
    ? parseRobots(robots.text)
    : { disallows: [], allows: [], sitemaps: [] };
  const disallows = robotsData.disallows;
  const allows = robotsData.allows || [];
  const sitemapSeeds =
    pathPrefix === "/docs"
      ? []
      : [`${base}/sitemap.xml`, `${base}/sitemap.xml.gz`, ...robotsData.sitemaps]
          .map((url) => resolveUrl(url, base, { allowSitemap: true, ...resolveOpts }))
          .filter(Boolean);
  const sitemapQueue = [...new Set(sitemapSeeds)];
  const sitemapSeen = new Set();
  const fromSitemap = [];
  while (sitemapQueue.length && sitemapSeen.size < MAX_SITEMAPS && fromSitemap.length < MAX_SITEMAP_URLS) {
    const sitemapUrl = sitemapQueue.shift();
    if (sitemapSeen.has(sitemapUrl)) continue;
    sitemapSeen.add(sitemapUrl);
    const sitemap = await fetchPinned(sitemapUrl, {
      timeoutMs: 8000,
      maxBytes: MAX_SITEMAP_COMPRESSED_BYTES,
      allowedOrigin: base,
      accept: "application/xml, text/xml, application/gzip;q=0.8, */*;q=0.5",
    });
    if (!sitemap.ok) continue;
    let xml = sitemap.text || "";
    try {
      xml = maybeGunzipSitemap(sitemap, sitemapUrl) || xml;
    } catch {
      continue;
    }
    if (!xml || (!/xml|text|gzip/i.test(sitemap.contentType || "xml") && !/<urlset|<sitemapindex/i.test(xml))) {
      continue;
    }
    const locs = extractLocs(xml);
    const isIndex = /<sitemapindex\b/i.test(xml);
    for (const loc of locs) {
      const resolved = resolveUrl(loc, base, { allowSitemap: true, ...resolveOpts });
      if (!resolved) continue;
      if (isIndex && sitemapSeen.size + sitemapQueue.length < MAX_SITEMAPS) sitemapQueue.push(resolved);
      else if (!isIndex && fromSitemap.length < MAX_SITEMAP_URLS && !fromSitemap.includes(resolved)) {
        fromSitemap.push(resolved);
      }
    }
  }

  const queue = [];
  const seen = new Set();
  const canonicalSeen = new Set();
  const contentHashSeen = new Set();
  const coverage = {
    renderMode: "static",
    discovered: 0,
    fetched: 0,
    indexed: 0,
    robotsBlocked: 0,
    privateSkipped: 0,
    nonHtmlSkipped: 0,
    spaShellSkipped: 0,
    contentDuplicates: 0,
    qualitySkipped: 0,
    failed: 0,
    httpErrors: 0,
    pending: 0,
    sitemapUrls: fromSitemap.length,
    budgetExhausted: false,
    needsBrowserRender: false,
    spaShellUrls: [],
    httpConcurrency: HTTP_FETCH_CONCURRENCY,
  };
  const enqueue = async (url, hop) => {
    if (!url || seen.has(url) || hop > MAX_HOPS) return;
    seen.add(url);
    try {
      const path = new URL(url).pathname || "/";
      if (pathPrefix && path !== pathPrefix && !path.startsWith(`${pathPrefix}/`)) {
        return;
      }
      if (robotsBlocks(disallows, path, allows)) {
        coverage.robotsBlocked += 1;
        return;
      }
    } catch {
      return;
    }
    coverage.discovered += 1;
    queue.push({ url, hop, score: scoreUrl(url) });
    queue.sort((a, b) => b.score - a.score);
    if (onDiscovered) await onDiscovered({ url, canonicalUrl: url, depth: hop });
  };

  if (pathPrefix === "/docs") {
    await enqueue(`${base}/docs`, 0);
  } else {
    await enqueue(`${base}/`, 0);
  }
  for (const loc of fromSitemap.slice(0, MAX_SITEMAP_URLS)) await enqueue(loc, 0);
  for (const item of resumeUrls) {
    const url = typeof item === "string" ? item : item?.url;
    const depth = Number.isInteger(item?.depth) ? item.depth : 0;
    const resolved = resolveUrl(url, base, resolveOpts);
    if (resolved) await enqueue(resolved, depth);
  }

  const pages = [];

  async function processQueuedPage(next) {
    let result;
    try {
      result = await fetchText(next.url, { allowedOrigin: base });
    } catch (error) {
      coverage.failed += 1;
      if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "FAILED", error: error?.details?.code || error?.message || "fetch_failed" });
      return;
    }
    coverage.fetched += 1;
    if (!result.ok || !/html|xml|text/i.test(result.contentType || "text/html")) {
      if (result.ok) {
        coverage.nonHtmlSkipped += 1;
        if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "SKIPPED", skipReason: "non_html_or_unavailable" });
      } else {
        coverage.failed += 1;
        if (result.status >= 400) coverage.httpErrors += 1;
        if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "FAILED", error: result.status ? `http_${result.status}` : "fetch_unavailable" });
      }
      return;
    }

    const title = extractTitle(result.text);
    const rawText = extractText(result.text);
    if (lookLikePrivatePage(title, rawText)) {
      coverage.privateSkipped += 1;
      if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "SKIPPED", title, skipReason: "private_or_auth_wall" });
      return;
    }
    let text = redactPublicText(rawText).slice(0, 8000);
    const qualitySkip = looksLikeLowQualityPage(title, text);
    if (qualitySkip) {
      coverage.qualitySkipped += 1;
      if (onPage) {
        await onPage({
          url: next.url,
          canonicalUrl: next.url,
          depth: next.hop,
          status: "SKIPPED",
          title,
          skipReason: qualitySkip,
        });
      }
      return;
    }
    const spaShell = looksLikeThinSpaShell(result.text, rawText);
    if (spaShell) {
      coverage.needsBrowserRender = true;
      coverage.spaShellSkipped += 1;
      if (coverage.spaShellUrls.length < 40) {
        coverage.spaShellUrls.push(next.url);
      }
      if (onPage) {
        await onPage({
          url: next.url,
          canonicalUrl: next.url,
          depth: next.hop,
          status: "SKIPPED",
          title,
          skipReason: "thin_spa_shell",
        });
      }
      return;
    }
    if (text.length < 40) {
      // Tiny real pages: keep title + meta when present. Do not promote SPA shells.
      const meta = extractMetaDescription(result.text);
      const shell = redactPublicText([title, meta].filter(Boolean).join("\n")).slice(0, 8000);
      if (shell.length >= 40 && !looksLikeThinSpaShell(result.text, shell)) {
        text = shell;
      } else {
        if (onPage) {
          await onPage({
            url: next.url,
            canonicalUrl: next.url,
            depth: next.hop,
            status: "SKIPPED",
            title,
            skipReason: "insufficient_public_text",
          });
        }
        return;
      }
    }

    let canonical = next.url;
    const canonicalHref = extractCanonical(result.text);
    if (canonicalHref) {
      try {
        canonical = resolveUrl(new URL(canonicalHref, next.url).toString(), base, resolveOpts) || next.url;
      } catch {
        canonical = next.url;
      }
    }
    if (canonicalSeen.has(canonical)) {
      if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "SKIPPED", title, skipReason: "canonical_duplicate" });
      return;
    }
    const contentHash = createHash("sha256").update(text).digest("hex");
    if (contentHashSeen.has(contentHash)) {
      coverage.contentDuplicates += 1;
      if (onPage) {
        await onPage({
          url: next.url,
          canonicalUrl: canonical,
          depth: next.hop,
          status: "SKIPPED",
          title,
          skipReason: "content_duplicate",
          contentHash,
        });
      }
      return;
    }
    canonicalSeen.add(canonical);
    contentHashSeen.add(contentHash);
    coverage.indexed += 1;
    if (onPage) {
      if (canonical !== next.url) {
        await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "SKIPPED", title, skipReason: "canonicalized" });
      }
      await onPage({
        url: next.url,
        canonicalUrl: canonical,
        depth: next.hop,
        status: "INDEXED",
        title: title || canonical,
        content: text,
        contentHash,
      });
    }
    pages.push({
      url: canonical,
      canonicalUrl: canonical,
      title: title || canonical,
      text,
      contentHash,
    });

    if (next.hop < MAX_HOPS) {
      for (const href of extractHrefs(result.text)) {
        const resolved = resolveUrl(href, base, resolveOpts);
        if (resolved) await enqueue(resolved, next.hop + 1);
      }
    }
  }

  while (queue.length && pages.length < MAX_PAGES) {
    const batch = [];
    while (
      batch.length < HTTP_FETCH_CONCURRENCY &&
      queue.length &&
      pages.length + batch.length < MAX_PAGES
    ) {
      batch.push(queue.shift());
    }
    if (!batch.length) break;
    await Promise.all(batch.map((item) => processQueuedPage(item)));
  }

  coverage.pending = queue.length;
  coverage.budgetExhausted = pages.length >= MAX_PAGES && queue.length > 0;
  return { origin: base, pages, coverage };
}

export { compileWebsiteDoc, httpError as crawlHttpError };
export async function assertCrawlSafeUrl(rawUrl, opts = {}) {
  const pinned = await assertSafeFetchUrl(rawUrl, opts);
  return pinned.url;
}
export { isPublicAddress as isCrawlAddressPublic };
