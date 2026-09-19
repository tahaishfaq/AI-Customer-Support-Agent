/**
 * Owner homepage URL parse — pure smoke (no DB).
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-crawl-homepage-url.mjs
 * Or: npm run test:crawl-homepage-url
 */
import assert from "node:assert/strict";

const { parseOwnerCrawlStartUrl } = await import(
  "../lib/services/site-crawler.js"
);

const ok = parseOwnerCrawlStartUrl("https://docs.example.com/help");
assert.equal(ok.skip, false);
assert.equal(ok.origin, "https://docs.example.com");
assert.equal(ok.startUrl, "https://docs.example.com/help");

const bare = parseOwnerCrawlStartUrl("brand.example.com");
assert.equal(bare.skip, false);
assert.equal(bare.origin, "https://brand.example.com");
assert.equal(bare.startUrl, "https://brand.example.com/");

const local = parseOwnerCrawlStartUrl("http://localhost:3000");
assert.equal(local.skip, true);
assert.equal(local.reason, "localhost");

const auth = parseOwnerCrawlStartUrl("https://shop.example.com/login");
assert.equal(auth.skip, true);
assert.equal(auth.reason, "auth-path");

const http = parseOwnerCrawlStartUrl("http://example.com");
assert.equal(http.skip, true);
assert.equal(http.reason, "not-https");

console.log("PASS  crawl homepage URL parse");
