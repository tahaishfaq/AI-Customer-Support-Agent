/**
 * Optional Playwright render crawl for thin SPA shells.
 * Opt-in via CRAWL_BROWSER_ENABLED=1. Fail-closed when off or Chromium missing.
 */
import { createHash } from "node:crypto";
import {
  assertCrawlSafeUrl,
  crawlHttpError,
  looksLikeThinSpaShell,
  resolveCrawlUrl,
} from "@/lib/services/site-crawler";
import {
  lookLikePrivatePage,
  redactPublicText,
} from "@/lib/services/site-redact";

const MAX_BROWSER_PAGES = 25;
const NAV_MS = 20_000;
const MAX_RENDER_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 3_000, 8_000];
const USER_AGENT = "AideBot/1.0 (+https://aide.app/bot)";

export function isCrawlBrowserEnabled() {
  const raw = String(process.env.CRAWL_BROWSER_ENABLED || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractRenderedText(page) {
  return page.evaluate(() => {
    const root =
      document.querySelector("main") ||
      document.querySelector("#root") ||
      document.querySelector("#app") ||
      document.body;
    if (!root) return { title: document.title || "", text: "" };
    const clone = root.cloneNode(true);
    for (const el of clone.querySelectorAll(
      "script, style, noscript, svg, iframe, [aria-hidden='true']"
    )) {
      el.remove();
    }
    const text = String(clone.innerText || clone.textContent || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    return { title: String(document.title || "").trim().slice(0, 120), text };
  });
}

async function renderOnePage(browserContext, url, allowedOrigin) {
  await assertCrawlSafeUrl(url, { allowedOrigin });
  const page = await browserContext.newPage();
  try {
    await page.route("**/*", async (route) => {
      const reqUrl = route.request().url();
      try {
        const parsed = new URL(reqUrl);
        if (parsed.origin !== allowedOrigin || parsed.protocol !== "https:") {
          await route.abort();
          return;
        }
      } catch {
        await route.abort();
        return;
      }
      await route.continue();
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_MS,
    });
    const status = response?.status?.() || 0;
    if (status >= 400) {
      const err = new Error(`http_${status}`);
      err.retryable = status >= 500;
      throw err;
    }

    // Give client apps a short window to hydrate.
    await sleep(1_200);
    try {
      await page.waitForLoadState("networkidle", { timeout: 4_000 });
    } catch {
      // SPA may keep sockets open — continue with whatever rendered.
    }

    const { title, text: rawText } = await extractRenderedText(page);
    if (lookLikePrivatePage(title, rawText)) {
      return {
        status: "SKIPPED",
        skipReason: "private_or_auth_wall",
        title,
      };
    }
    const text = redactPublicText(rawText).slice(0, 8000);
    if (text.length < 40 || looksLikeThinSpaShell("", text)) {
      return {
        status: "SKIPPED",
        skipReason: "insufficient_public_text",
        title,
      };
    }
    const contentHash = createHash("sha256").update(text).digest("hex");
    return {
      status: "INDEXED",
      title: title || url,
      text,
      contentHash,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function renderWithRetries(browserContext, url, allowedOrigin) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt += 1) {
    try {
      const result = await renderOnePage(browserContext, url, allowedOrigin);
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
      const retryable =
        error?.retryable === true ||
        /timeout|net::|NS_ERROR|Navigation|Target closed|http_5/i.test(
          String(error?.message || "")
        );
      if (!retryable || attempt >= MAX_RENDER_ATTEMPTS) break;
      await sleep(BACKOFF_MS[attempt - 1] || 8_000);
    }
  }
  return {
    status: "FAILED",
    error: String(lastError?.message || "nav_fail").slice(0, 200),
    attempts: MAX_RENDER_ATTEMPTS,
  };
}

/**
 * Render-crawl seed URLs with headless Chromium.
 * @returns {{ origin: string, pages: object[], coverage: object }}
 */
export async function crawlPublicOriginBrowser(origin, options = {}) {
  if (!isCrawlBrowserEnabled()) {
    throw crawlHttpError(
      503,
      "Browser crawl is disabled. Set CRAWL_BROWSER_ENABLED=1 to index JavaScript-rendered pages.",
      { code: "CRAWL_BROWSER_DISABLED" }
    );
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw crawlHttpError(
      503,
      "Playwright is not installed for browser crawl",
      { code: "CRAWL_BROWSER_UNAVAILABLE" }
    );
  }

  const base = String(origin || "").replace(/\/$/, "");
  await assertCrawlSafeUrl(`${base}/`, { allowedOrigin: base });

  const onDiscovered = options.onDiscovered;
  const onPage = options.onPage;
  const seedRaw = Array.isArray(options.seedUrls) ? options.seedUrls : [];
  const seeds = [];
  const pushSeed = (raw) => {
    const resolved = resolveCrawlUrl(raw, base);
    if (!resolved || seeds.includes(resolved)) return;
    seeds.push(resolved);
  };
  pushSeed(`${base}/`);
  for (const item of seedRaw) {
    const url = typeof item === "string" ? item : item?.url;
    if (url) pushSeed(url);
  }

  const coverage = {
    renderMode: "browser",
    discovered: 0,
    fetched: 0,
    indexed: 0,
    failed: 0,
    privateSkipped: 0,
    spaShellSkipped: 0,
    pending: 0,
    budgetExhausted: false,
    renderAttempts: 0,
    browserEnabled: true,
    needsBrowserRender: false,
  };

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage"],
    });
  } catch (error) {
    throw crawlHttpError(
      503,
      `Browser crawl Chromium unavailable: ${String(error?.message || "launch_failed").slice(0, 160)}. Run: npx playwright install chromium`,
      { code: "CRAWL_BROWSER_UNAVAILABLE" }
    );
  }

  const pages = [];
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: false,
    });

    for (const url of seeds.slice(0, MAX_BROWSER_PAGES)) {
      coverage.discovered += 1;
      if (onDiscovered) {
        await onDiscovered({ url, canonicalUrl: url, depth: 0 });
      }

      const rendered = await renderWithRetries(context, url, base);
      coverage.renderAttempts += Number(rendered.attempts || 1);
      coverage.fetched += 1;

      if (rendered.status === "SKIPPED") {
        if (rendered.skipReason === "private_or_auth_wall") {
          coverage.privateSkipped += 1;
        } else {
          coverage.spaShellSkipped += 1;
        }
        if (onPage) {
          await onPage({
            url,
            canonicalUrl: url,
            depth: 0,
            status: "SKIPPED",
            title: rendered.title,
            skipReason: rendered.skipReason,
          });
        }
        continue;
      }

      if (rendered.status !== "INDEXED") {
        coverage.failed += 1;
        if (onPage) {
          await onPage({
            url,
            canonicalUrl: url,
            depth: 0,
            status: "FAILED",
            error: rendered.error || "nav_fail",
          });
        }
        continue;
      }

      coverage.indexed += 1;
      if (onPage) {
        await onPage({
          url,
          canonicalUrl: url,
          depth: 0,
          status: "INDEXED",
          title: rendered.title,
          content: rendered.text,
          contentHash: rendered.contentHash,
        });
      }
      pages.push({
        url,
        canonicalUrl: url,
        title: rendered.title,
        text: rendered.text,
        contentHash: rendered.contentHash,
      });
    }

    await context.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }

  return { origin: base, pages, coverage };
}
