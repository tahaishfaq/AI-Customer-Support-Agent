/**
 * SPA shell detect + browser crawl flag-off contract.
 * Run: npm run test:crawl-spa-detect
 */
import assert from "node:assert/strict";

const { looksLikeThinSpaShell, isHashClientRoute, looksLikeLowQualityPage } = await import(
  "../lib/services/site-crawler.js"
);
const browserMod = await import("../lib/services/site-crawler-browser.js");
const { isCrawlBrowserEnabled, crawlPublicOriginBrowser } =
  browserMod.default || browserMod;

const craHtml = `<!doctype html><html><head>
<meta name="description" content="Web site created using create-react-app"/>
<title>Brandly</title>
<script defer src="/static/js/main.abc.js"></script>
</head><body><noscript>You need to enable JavaScript to run this app.</noscript>
<div id="root"></div></body></html>`;

assert.equal(
  looksLikeThinSpaShell(craHtml, ""),
  true,
  "CRA empty #root is thin SPA shell"
);
assert.equal(
  looksLikeThinSpaShell(
    `<html><body><div id="app"></div><script src="/js/app.js"></script></body></html>`,
    ""
  ),
  true,
  "empty #app is thin SPA shell"
);
assert.equal(
  looksLikeThinSpaShell(
    `<html><body><div id="__next"></div><script src="/_next/static/chunks/main.js"></script><script src="/_next/static/chunks/pages.js"></script><script src="/_next/static/chunks/webpack.js"></script></body></html>`,
    ""
  ),
  true,
  "empty #__next CSR shell is thin SPA"
);
assert.equal(isHashClientRoute("#/pricing"), true);
assert.equal(isHashClientRoute("#features"), false);
assert.equal(looksLikeLowQualityPage("404 Not Found", "page not found"), "soft_404");
assert.equal(looksLikeLowQualityPage("Sign in", "Enter your password to continue"), "login_wall");

const { isBlockedBrowserTarget } = browserMod.default || browserMod;
assert.equal(isBlockedBrowserTarget("http://example.com/", { navigationOrigin: "https://example.com" }), true);
assert.equal(isBlockedBrowserTarget("https://127.0.0.1/", { navigationOrigin: "https://example.com" }), true);
assert.equal(isBlockedBrowserTarget("https://169.254.169.254/latest/meta-data", { navigationOrigin: "https://example.com" }), true);
assert.equal(isBlockedBrowserTarget("https://cdn.example.net/app.js"), false);
assert.equal(isBlockedBrowserTarget("https://other.com/escape", { navigationOrigin: "https://example.com" }), true);

const prev = process.env.CRAWL_BROWSER_ENABLED;
process.env.CRAWL_BROWSER_ENABLED = "0";
assert.equal(isCrawlBrowserEnabled(), false, "flag off");
let blocked = false;
try {
  await crawlPublicOriginBrowser("https://example.com", {
    seedUrls: ["https://example.com/"],
  });
} catch (error) {
  blocked =
    error?.details?.code === "CRAWL_BROWSER_DISABLED" ||
    /disabled/i.test(error.message);
}
assert.equal(blocked, true, "browser crawl fail-closed when flag off");
if (prev === undefined) delete process.env.CRAWL_BROWSER_ENABLED;
else process.env.CRAWL_BROWSER_ENABLED = prev;

console.log("PASS  crawl spa detect + browser flag-off");
