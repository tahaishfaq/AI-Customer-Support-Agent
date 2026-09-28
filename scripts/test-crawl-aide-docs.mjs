/**
 * Owner crawl: Aide /docs allowed; app root blocked.
 * Run: node --import ./scripts/register-aliases.mjs scripts/test-crawl-aide-docs.mjs
 */
import assert from "node:assert/strict";
import {
  isAideDocsPath,
  parseOwnerCrawlStartUrl,
  parseOwnerCrawlUrlList,
  shouldSkipCrawlOrigin,
} from "../lib/services/site-crawler.js";

const APP = "https://ai-customer-support-agent-coral.vercel.app";

assert.equal(isAideDocsPath("/docs"), true);
assert.equal(isAideDocsPath("/docs/faq"), true);
assert.equal(isAideDocsPath("/agents"), false);

assert.equal(
  shouldSkipCrawlOrigin(APP, APP).reason,
  "own-product",
  "bare app origin skipped"
);
assert.equal(
  shouldSkipCrawlOrigin(APP, APP, { allowAideDocs: true }).skip,
  false,
  "allowAideDocs opens own origin"
);

const root = parseOwnerCrawlStartUrl(APP, APP);
assert.equal(root.skip, true);
assert.equal(root.reason, "own-product");
assert.match(String(root.message || ""), /\/docs/i);

const docs = parseOwnerCrawlStartUrl(`${APP}/docs`, APP);
assert.equal(docs.skip, false);
assert.equal(docs.origin, APP);
assert.equal(docs.pathPrefix, "/docs");
assert.ok(docs.startUrl.endsWith("/docs"));

const faq = parseOwnerCrawlStartUrl(`${APP}/docs/faq`, APP);
assert.equal(faq.skip, false);
assert.equal(faq.pathPrefix, "/docs");

const login = parseOwnerCrawlStartUrl(`${APP}/login`, APP);
assert.equal(login.skip, true);

const list = parseOwnerCrawlUrlList(
  [`${APP}/docs`, `${APP}/docs/getting-started/what-is-aide`],
  APP
);
assert.equal(list.skip, false);
assert.equal(list.pathPrefix, "/docs");
assert.equal(list.startUrls.length, 2);

const mixed = parseOwnerCrawlUrlList([`${APP}/docs`, `${APP}/agents`], APP);
assert.equal(mixed.skip, true);

const external = parseOwnerCrawlStartUrl("https://example.com/help", APP);
assert.equal(external.skip, false);
assert.equal(external.pathPrefix, null);

console.log("PASS  crawl aide docs allowlist");
