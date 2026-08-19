import { chatCompletion } from "@/lib/services/ai/llm.provider";
import {
  lookLikePrivatePage,
  redactPublicText,
} from "@/lib/services/site-redact";

const MAX_PAGES = 25;
const MAX_HOPS = 2;
const MAX_HTML_BYTES = 150_000;
const FETCH_MS = 8_000;
const USER_AGENT = "HapyBot/1.0 (+https://hapy.co/bot)";

const SKIP_PATH =
  /(^|\/)(admin|login|signin|sign-in|signup|sign-up|account|dashboard|wp-admin|api|cart|checkout)(\/|$)|\/\.git|\.env/i;

const SKIP_QUERY = /(^|[?&])(token|session|key|auth|password)=/i;

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

async function fetchText(url, { timeoutMs = FETCH_MS, maxBytes = MAX_HTML_BYTES } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) return { ok: false, status: res.status, text: "" };
    const buf = Buffer.from(await res.arrayBuffer());
    const sliced = buf.subarray(0, maxBytes).toString("utf8");
    return { ok: true, status: res.status, text: sliced, contentType: res.headers.get("content-type") || "" };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

function parseRobots(text, userAgent = "HapyBot") {
  const disallows = [];
  let applies = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const k = key.trim().toLowerCase();
    if (k === "user-agent") {
      applies = value === "*" || value.toLowerCase().includes(userAgent.toLowerCase());
    } else if (k === "disallow" && applies) {
      if (value) disallows.push(value);
    }
  }
  return disallows;
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
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHrefs(html) {
  return [...String(html || "").matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(
    (m) => m[1].trim()
  );
}

export function normalizeHttpsOrigin(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return { skip: true, reason: "localhost" };
    }
    if (url.protocol !== "https:") {
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

function resolveUrl(href, origin) {
  try {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return null;
    }
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    if (SKIP_EXT.test(url.pathname)) return null;
    if (SKIP_PATH.test(url.pathname)) return null;
    if (SKIP_QUERY.test(url.search)) return null;
    url.hash = "";
    if (url.search && SKIP_QUERY.test(url.search)) return null;
    // drop tracking noise
    url.search = "";
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
export async function crawlPublicOrigin(origin) {
  const parsed = shouldSkipCrawlOrigin(origin);
  if (parsed.skip) {
    throw httpError(400, "This origin cannot be crawled", { origin: parsed.reason });
  }
  const base = parsed.origin;

  const robots = await fetchText(`${base}/robots.txt`, { timeoutMs: 5000 });
  const disallows = robots.ok ? parseRobots(robots.text) : [];

  const sitemap = await fetchText(`${base}/sitemap.xml`, { timeoutMs: 8000 });
  const fromSitemap = sitemap.ok
    ? extractLocs(sitemap.text)
        .map((loc) => resolveUrl(loc, base))
        .filter(Boolean)
        .filter((u) => HINT.test(u) || new URL(u).pathname === "/")
    : [];

  const queue = [];
  const seen = new Set();
  const enqueue = (url, hop) => {
    if (!url || seen.has(url) || hop > MAX_HOPS) return;
    try {
      const path = new URL(url).pathname || "/";
      if (robotsBlocks(disallows, path)) return;
    } catch {
      return;
    }
    seen.add(url);
    queue.push({ url, hop, score: scoreUrl(url) });
    queue.sort((a, b) => b.score - a.score);
  };

  enqueue(`${base}/`, 0);
  for (const loc of fromSitemap.slice(0, 40)) enqueue(loc, 0);

  const pages = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const next = queue.shift();
    const result = await fetchText(next.url);
    if (!result.ok || !/html|xml|text/i.test(result.contentType || "text/html")) {
      continue;
    }

    const title = extractTitle(result.text);
    const rawText = extractText(result.text);
    if (lookLikePrivatePage(title, rawText)) continue;
    const text = redactPublicText(rawText).slice(0, 8000);
    if (text.length < 40) continue;

    pages.push({ url: next.url, title: title || next.url, text });

    if (next.hop < MAX_HOPS) {
      for (const href of extractHrefs(result.text)) {
        const resolved = resolveUrl(href, base);
        if (resolved) enqueue(resolved, next.hop + 1);
      }
    }
  }

  return { origin: base, pages };
}

export { compileWebsiteDoc, httpError as crawlHttpError };
