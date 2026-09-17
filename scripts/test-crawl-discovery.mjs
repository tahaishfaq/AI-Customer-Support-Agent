import assert from "node:assert/strict";
import crawler from "../lib/services/site-crawler.js";

const { crawlPublicOrigin } = crawler;
const origin = "https://93.184.216.34";
const page = (name, extra = "") =>
  `<html><head><title>${name}</title></head><body><h1>${name}</h1>${name} public support information with enough detail to index safely. ${extra}</body></html>`;

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/robots.txt") {
      return new Response(
        `User-agent: *\nDisallow: /private\nSitemap: ${origin}/sitemap-index.xml`,
        { headers: { "content-type": "text/plain" } }
      );
    }
    if (path === "/sitemap.xml") return new Response("missing", { status: 404 });
    if (path === "/sitemap-index.xml") {
      return new Response(
        `<sitemapindex><sitemap><loc>${origin}/sitemap-a.xml</loc></sitemap><sitemap><loc>/sitemap-b.xml</loc></sitemap></sitemapindex>`,
        { headers: { "content-type": "application/xml" } }
      );
    }
    if (path === "/sitemap-a.xml") {
      return new Response(
        `<urlset><url><loc>/pricing</loc></url><url><loc>/about</loc></url><url><loc>/linked</loc></url><url><loc>/duplicate</loc></url></urlset>`,
        { headers: { "content-type": "application/xml" } }
      );
    }
    if (path === "/sitemap-b.xml") {
      return new Response(
        `<urlset><url><loc>/features</loc></url><url><loc>/private</loc></url><url><loc>/trap?page=101</loc></url><url><loc>/trap?page=2</loc></url></urlset>`,
        { headers: { "content-type": "application/xml" } }
      );
    }
    if (path === "/duplicate") {
      return new Response(page("Duplicate", `<link rel="canonical" href="/about">`), { headers: { "content-type": "text/html" } });
    }
    if (path === "/") {
      return new Response(page("Home", `<ul><li>First support step</li><li>Second support step</li></ul><table><tr><th>Plan</th><th>Price</th></tr><tr><td>Starter</td><td>$10</td></tr></table><a href="/linked">Linked</a><a href="/private">Private</a><a href="https://other.example/nope">External</a>`), { headers: { "content-type": "text/html" } });
    }
    return new Response(page(path), { headers: { "content-type": "text/html" } });
  };

  const discovered = [];
  const indexed = [];
  const result = await crawlPublicOrigin(origin, {
    resumeUrls: [{ url: `${origin}/resumed`, depth: 1 }],
    onDiscovered: (item) => discovered.push(item),
    onPage: (item) => indexed.push(item),
  });
  const urls = result.pages.map((item) => new URL(item.url).pathname);
  assert.ok(urls.includes("/features"), "non-help sitemap page is discovered");
  assert.ok(urls.includes("/linked"), "same-origin internal link is discovered");
  assert.ok(urls.includes("/trap"), "bounded pagination query is discovered");
  assert.equal(urls.includes("/private"), false, "robots-disallowed page is excluded");
  assert.equal(urls.filter((url) => url === "/about").length, 1, "canonical duplicate is deduped");
  assert.equal(urls.some((url) => url.includes("101")), false, "pagination trap is bounded");
  assert.ok(result.coverage.sitemapUrls >= 4, "sitemap index coverage is reported");
  assert.equal(result.coverage.pending, 0, "fixture frontier is exhausted");
  assert.ok(discovered.some((item) => item.url.endsWith("/resumed")), "persisted frontier can resume");
  const indexedPages = indexed.filter((item) => item.status === "INDEXED");
  assert.ok(indexedPages.length > 0 && indexedPages.every((item) => /^[a-f0-9]{64}$/.test(item.contentHash)), "indexed pages carry SHA-256 hashes");
  assert.ok(result.pages.length > 0 && result.pages.every((item) => item.canonicalUrl), "returned pages carry canonical URLs for knowledge sync");
  const home = result.pages.find((item) => new URL(item.url).pathname === "/");
  assert.match(home.text, /- First support step/);
  assert.match(home.text, /Starter.*\$10/s);
  assert.ok(indexed.some((item) => ["canonicalized", "canonical_duplicate"].includes(item.skipReason)), "canonical source is marked skipped");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("PASS crawl discovery: sitemap indexes, all same-origin links, canonical dedupe, robots and query traps");
