/**
 * SPA shell detect + browser crawl flag-off contract.
 * Run: npm run test:crawl-spa-detect
 */
import assert from "node:assert/strict";

const { looksLikeThinSpaShell } = await import(
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
    "<html><body><h1>Refund policy</h1><p>Returns within 30 days.</p></body></html>",
    "Refund policy\nReturns within 30 days."
  ),
  false,
  "normal HTML is not SPA shell"
);

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
