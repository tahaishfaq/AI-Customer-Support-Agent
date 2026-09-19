import { chatCompletion } from "@/lib/services/ai/llm.provider";
import dns from "node:dns/promises";
import { createHash } from "node:crypto";
import ipaddr from "ipaddr.js";
import {
  lookLikePrivatePage,
  redactPublicText,
} from "@/lib/services/site-redact";

const MAX_PAGES = 100;
const MAX_HOPS = 4;
const MAX_SITEMAPS = 8;
const MAX_SITEMAP_URLS = 500;
const MAX_HTML_BYTES = 150_000;
const FETCH_MS = 8_000;
const MAX_REDIRECTS = 4;
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
  if (allowedOrigin && url.origin !== allowedOrigin) {
    throw httpError(400, "Crawl redirect left the approved origin", { code: "CRAWL_REDIRECT_ORIGIN" });
  }

  const hostname = url.hostname.toLowerCase();
  if (ipaddr.isValid(hostname)) {
    if (!isPublicAddress(hostname)) {
      throw httpError(400, "Crawl destination is not public", { code: "CRAWL_PRIVATE_NETWORK" });
    }
    return url;
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw httpError(400, "Crawl hostname could not be resolved", { code: "CRAWL_DNS_FAILED" });
  }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw httpError(400, "Crawl destination is not public", { code: "CRAWL_PRIVATE_NETWORK" });
  }
  return url;
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

async function fetchText(url, { timeoutMs = FETCH_MS, maxBytes = MAX_HTML_BYTES, allowedOrigin } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = await assertSafeFetchUrl(url, { allowedOrigin });
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": USER_AGENT,
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || redirects === MAX_REDIRECTS) {
          throw httpError(400, "Crawl redirect limit exceeded", { code: "CRAWL_REDIRECT_LIMIT" });
        }
        current = await assertSafeFetchUrl(new URL(location, current), { allowedOrigin });
        continue;
      }
      if (!res.ok) return { ok: false, status: res.status, text: "" };
      const declaredLength = Number(res.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw httpError(413, "Crawl response is too large", { code: "CRAWL_BODY_LIMIT" });
      }
      const buf = await readBoundedBody(res.body, maxBytes);
      const sliced = buf.toString("utf8");
      return { ok: true, status: res.status, text: sliced, contentType: res.headers.get("content-type") || "" };
    }
    throw httpError(400, "Crawl redirect limit exceeded", { code: "CRAWL_REDIRECT_LIMIT" });
  } catch (error) {
    if (error?.status) throw error;
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobots(text, userAgent = "AideBot") {
  const disallows = [];
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
    }
  }
  return { disallows, sitemaps };
}

function robotsBlocks(disallows, pathname) {
  return disallows.some((rule) => pathname.startsWith(rule));
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

export function shouldSkipCrawlOrigin(origin, appOrigin) {
  const parsed = normalizeHttpsOrigin(origin);
  if (!parsed || parsed.skip) return { skip: true, reason: parsed?.reason || "invalid" };
  if (appOrigin) {
    try {
      if (new URL(appOrigin).origin === parsed.origin) {
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
 * @returns {{ skip: true, reason: string } | { skip: false, origin: string, startUrl: string }}
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
  const originCheck = shouldSkipCrawlOrigin(candidate, appOrigin);
  if (originCheck.skip) {
    return { skip: true, reason: originCheck.reason || "invalid" };
  }
  let path = url.pathname || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  if (SKIP_PATH.test(path)) {
    return { skip: true, reason: "auth-path" };
  }
  if (SKIP_QUERY.test(url.search || "")) {
    return { skip: true, reason: "auth-query" };
  }
  const startUrl =
    path === "/" ? `${originCheck.origin}/` : `${originCheck.origin}${path}`;
  return { skip: false, origin: originCheck.origin, startUrl };
}

function resolveUrl(href, origin, { allowSitemap = false } = {}) {
  try {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return null;
    }
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    if (SKIP_EXT.test(url.pathname) && !(allowSitemap && /\.xml$/i.test(url.pathname))) return null;
    if (SKIP_PATH.test(url.pathname)) return null;
    if (SKIP_QUERY.test(url.search)) return null;
    url.hash = "";
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
  const parsed = shouldSkipCrawlOrigin(origin);
  if (parsed.skip) {
    throw httpError(400, "This origin cannot be crawled", { origin: parsed.reason });
  }
  const base = parsed.origin;
  await assertSafeFetchUrl(base, { allowedOrigin: base });

  const robots = await fetchText(`${base}/robots.txt`, { timeoutMs: 5000, allowedOrigin: base });
  const robotsData = robots.ok ? parseRobots(robots.text) : { disallows: [], sitemaps: [] };
  const disallows = robotsData.disallows;
  const sitemapSeeds = [`${base}/sitemap.xml`, ...robotsData.sitemaps]
    .map((url) => resolveUrl(url, base, { allowSitemap: true }))
    .filter(Boolean);
  const sitemapQueue = [...new Set(sitemapSeeds)];
  const sitemapSeen = new Set();
  const fromSitemap = [];
  while (sitemapQueue.length && sitemapSeen.size < MAX_SITEMAPS && fromSitemap.length < MAX_SITEMAP_URLS) {
    const sitemapUrl = sitemapQueue.shift();
    if (sitemapSeen.has(sitemapUrl)) continue;
    sitemapSeen.add(sitemapUrl);
    const sitemap = await fetchText(sitemapUrl, { timeoutMs: 8000, allowedOrigin: base });
    if (!sitemap.ok || !/xml|text/i.test(sitemap.contentType || "xml")) continue;
    const locs = extractLocs(sitemap.text);
    const isIndex = /<sitemapindex\b/i.test(sitemap.text);
    for (const loc of locs) {
      const resolved = resolveUrl(loc, base, { allowSitemap: true });
      if (!resolved) continue;
      if (isIndex && sitemapSeen.size + sitemapQueue.length < MAX_SITEMAPS) sitemapQueue.push(resolved);
      else if (!isIndex && fromSitemap.length < MAX_SITEMAP_URLS) fromSitemap.push(resolved);
    }
  }

  const queue = [];
  const seen = new Set();
  const canonicalSeen = new Set();
  const coverage = {
    discovered: 0,
    fetched: 0,
    indexed: 0,
    robotsBlocked: 0,
    privateSkipped: 0,
    nonHtmlSkipped: 0,
    failed: 0,
    httpErrors: 0,
    pending: 0,
    sitemapUrls: fromSitemap.length,
    budgetExhausted: false,
  };
  const enqueue = async (url, hop) => {
    if (!url || seen.has(url) || hop > MAX_HOPS) return;
    try {
      const path = new URL(url).pathname || "/";
      if (robotsBlocks(disallows, path)) {
        coverage.robotsBlocked += 1;
        return;
      }
    } catch {
      return;
    }
    seen.add(url);
    coverage.discovered += 1;
    queue.push({ url, hop, score: scoreUrl(url) });
    queue.sort((a, b) => b.score - a.score);
    if (onDiscovered) await onDiscovered({ url, canonicalUrl: url, depth: hop });
  };

  await enqueue(`${base}/`, 0);
  for (const loc of fromSitemap.slice(0, MAX_SITEMAP_URLS)) await enqueue(loc, 0);
  for (const item of resumeUrls) {
    const url = typeof item === "string" ? item : item?.url;
    const depth = Number.isInteger(item?.depth) ? item.depth : 0;
    const resolved = resolveUrl(url, base);
    if (resolved) await enqueue(resolved, depth);
  }

  const pages = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const next = queue.shift();
    let result;
    try {
      result = await fetchText(next.url, { allowedOrigin: base });
    } catch (error) {
      coverage.failed += 1;
      if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "FAILED", error: error?.details?.code || error?.message || "fetch_failed" });
      continue;
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
      continue;
    }

    const title = extractTitle(result.text);
    const rawText = extractText(result.text);
    if (lookLikePrivatePage(title, rawText)) {
      coverage.privateSkipped += 1;
      if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "SKIPPED", title, skipReason: "private_or_auth_wall" });
      continue;
    }
    const text = redactPublicText(rawText).slice(0, 8000);
    if (text.length < 40) {
      if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "SKIPPED", title, skipReason: "insufficient_public_text" });
      continue;
    }

    let canonical = next.url;
    const canonicalHref = extractCanonical(result.text);
    if (canonicalHref) {
      try {
        canonical = resolveUrl(new URL(canonicalHref, next.url).toString(), base) || next.url;
      } catch {
        canonical = next.url;
      }
    }
    if (canonicalSeen.has(canonical)) {
      if (onPage) await onPage({ url: next.url, canonicalUrl: next.url, depth: next.hop, status: "SKIPPED", title, skipReason: "canonical_duplicate" });
      continue;
    }
    canonicalSeen.add(canonical);
    coverage.indexed += 1;
    const contentHash = createHash("sha256").update(text).digest("hex");
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
        const resolved = resolveUrl(href, base);
        if (resolved) await enqueue(resolved, next.hop + 1);
      }
    }
  }

  coverage.pending = queue.length;
  coverage.budgetExhausted = pages.length >= MAX_PAGES && queue.length > 0;
  return { origin: base, pages, coverage };
}

export { compileWebsiteDoc, httpError as crawlHttpError };

export { isPublicAddress as isCrawlAddressPublic };
