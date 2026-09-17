import assert from "node:assert/strict";
import crawler from "../lib/services/site-crawler.js";

const {
  crawlPublicOrigin,
  isCrawlAddressPublic,
  normalizeHttpsOrigin,
} = crawler;

function response(body = "", status = 200, headers = {}) {
  return new Response(body, { status, headers });
}

async function rejectsWithCode(work, code) {
  await assert.rejects(work, (error) => error?.details?.code === code);
}

assert.equal(isCrawlAddressPublic("8.8.8.8"), true);
assert.equal(isCrawlAddressPublic("10.0.0.1"), false);
assert.equal(isCrawlAddressPublic("192.168.1.10"), false);
assert.equal(isCrawlAddressPublic("127.0.0.1"), false);
assert.equal(isCrawlAddressPublic("169.254.169.254"), false);
assert.equal(isCrawlAddressPublic("::1"), false);
assert.deepEqual(normalizeHttpsOrigin("http://example.com"), { skip: true, reason: "not-https" });
assert.deepEqual(normalizeHttpsOrigin("https://user:pass@example.com"), { skip: true, reason: "not-https" });

await rejectsWithCode(
  () => crawlPublicOrigin("https://10.0.0.1"),
  "CRAWL_PRIVATE_NETWORK"
);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/robots.txt") return response("User-agent: *\nAllow: /");
    if (path === "/sitemap.xml") return response("<urlset></urlset>", 200, { "content-type": "application/xml" });
    return response("<html><title>Home</title><body>Public support content with enough detail for the bounded crawler test.</body></html>", 200, { "content-type": "text/html" });
  };
  const result = await crawlPublicOrigin("https://93.184.216.34");
  assert.equal(result.pages.length, 1, "public HTTPS page should be crawled");

  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/robots.txt") return response("", 302, { location: "https://1.1.1.1/robots.txt" });
    return response("");
  };
  await rejectsWithCode(
    () => crawlPublicOrigin("https://93.184.216.34"),
    "CRAWL_REDIRECT_ORIGIN"
  );

  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/robots.txt") return response("x".repeat(150_001), 200, { "content-type": "text/plain" });
    return response("");
  };
  await rejectsWithCode(
    () => crawlPublicOrigin("https://93.184.216.34"),
    "CRAWL_BODY_LIMIT"
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("PASS crawl transport: public-address validation, redirect origin lock, bounded body");
