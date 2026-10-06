/**
 * Structured crawl events — no page bodies or secrets.
 */

function hostOf(origin) {
  try {
    return new URL(String(origin || "")).host || null;
  } catch {
    return null;
  }
}

export function logCrawlEvent(event, fields = {}) {
  const payload = {
    event,
    at: new Date().toISOString(),
    crawlId: fields.crawlId || fields.siteCrawlJobId || null,
    agentId: fields.agentId || null,
    workspaceId: fields.workspaceId || null,
    host: fields.host || hostOf(fields.origin),
    status: fields.status || null,
    reason: fields.reason || fields.code || null,
    requestId: fields.requestId || null,
    pages_discovered: fields.pages_discovered ?? fields.discovered ?? undefined,
    pages_http_fetched: fields.pages_http_fetched ?? fields.fetched ?? undefined,
    pages_rendered: fields.pages_rendered ?? fields.rendered ?? undefined,
    pages_indexed: fields.pages_indexed ?? fields.indexed ?? undefined,
    pages_skipped: fields.pages_skipped ?? fields.skipped ?? undefined,
    pages_duplicate: fields.pages_duplicate ?? fields.duplicates ?? undefined,
    pages_failed: fields.pages_failed ?? fields.failed ?? undefined,
    sitemap_found: fields.sitemap_found,
    sitemap_urls: fields.sitemap_urls,
    render_fallback_used: fields.render_fallback_used,
    duration_ms: fields.duration_ms,
  };
  console.log(JSON.stringify(payload));
}
