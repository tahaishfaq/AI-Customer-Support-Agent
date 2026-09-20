"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { retrySiteCrawl } from "@/lib/api/knowledge";

const MAX_URLS = 20;

/**
 * Soft client checks before API. Server remains authoritative (SSRF, auth paths).
 * @returns {{ urls: string[], error: string | null }}
 */
function validateCrawlUrls(raw) {
  const lines = String(raw || "")
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { urls: [], error: "Enter at least one public https page URL" };
  }
  if (lines.length > MAX_URLS) {
    return {
      urls: [],
      error: `Enter at most ${MAX_URLS} URLs at a time`,
    };
  }

  const normalized = [];
  let origin = null;
  for (const line of lines) {
    let candidate = line;
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
    let url;
    try {
      url = new URL(candidate);
    } catch {
      return { urls: [], error: `Invalid URL: ${line}` };
    }
    if (url.protocol !== "https:") {
      return {
        urls: [],
        error: "Only public https URLs are allowed (not http)",
      };
    }
    if (
      /^(localhost|127\.0\.0\.1)$/i.test(url.hostname) ||
      url.hostname.endsWith(".local")
    ) {
      return {
        urls: [],
        error: "Localhost cannot be crawled — use a public https URL",
      };
    }
    if (!origin) origin = url.origin;
    else if (url.origin !== origin) {
      return {
        urls: [],
        error: "All URLs must be on the same website (same https domain)",
      };
    }
    normalized.push(url.toString().replace(/\/$/, "") || url.origin);
  }

  return { urls: normalized, error: null };
}

/**
 * Always-available owner crawl / re-crawl.
 * One or more public https URLs (same site), one per line.
 */
export function CrawlNowPanel({
  agentId,
  siteKnowledgeOrigin = null,
  latestCrawl = null,
  crawlActive = false,
  onQueued,
}) {
  const [urlsText, setUrlsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const touchedRef = useRef(false);

  // Seed once from known origin — do not fight the user when they clear the field.
  useEffect(() => {
    if (touchedRef.current || urlsText.trim()) return;
    const seed =
      siteKnowledgeOrigin ||
      latestCrawl?.origin ||
      "";
    if (!seed) return;
    setUrlsText(String(seed).replace(/\/$/, ""));
  }, [siteKnowledgeOrigin, latestCrawl?.origin, urlsText]);

  async function handleCrawl() {
    if (busy || crawlActive) return;
    const { urls, error } = validateCrawlUrls(urlsText);
    setFieldError(error || "");
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      const result = await retrySiteCrawl(agentId, { urls });
      onQueued?.(result);
      const n = Array.isArray(result.startUrls)
        ? result.startUrls.length
        : urls.length;
      toast.success(
        n > 1
          ? `Crawl queued (${n} seed pages)`
          : "Website crawl queued"
      );
      setFieldError("");
    } catch (err) {
      const message = err.message || "Unable to start crawl";
      setFieldError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const status = latestCrawl?.status || null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Crawl / re-crawl website
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Paste one or more public https page URLs from the same site (one per
            line). Aide indexes public HTML first; JavaScript SPA shells need
            browser crawl (`CRAWL_BROWSER_ENABLED`). Login/admin URLs are skipped.
          </p>
        </div>
        {status ? (
          <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {status === "RUNNING"
              ? "Crawling…"
              : status === "QUEUED"
                ? "Queued"
                : status === "FAILED"
                  ? "Last crawl failed"
                  : status === "PARTIAL"
                    ? "Last crawl partial"
                    : status === "DONE"
                      ? "Last crawl done"
                      : status}
          </span>
        ) : null}
      </div>

      <Textarea
        value={urlsText}
        onChange={(event) => {
          touchedRef.current = true;
          setUrlsText(event.target.value);
          if (fieldError) setFieldError("");
        }}
        disabled={busy || crawlActive}
        rows={4}
        className="mt-3 font-mono text-[12px]"
        placeholder={
          "https://yoursite.com\nhttps://yoursite.com/pricing\nhttps://yoursite.com/help"
        }
        aria-label="Website page URLs to crawl"
        aria-invalid={fieldError ? true : undefined}
      />
      {fieldError ? (
        <p className="mt-1.5 text-[12px] text-destructive" role="alert">
          {fieldError}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || crawlActive || !urlsText.trim()}
          onClick={() => void handleCrawl()}
        >
          {busy || crawlActive ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          {crawlActive ? "Crawl in progress…" : "Re-crawl now"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Up to {MAX_URLS} URLs · same https domain
        </p>
      </div>
    </div>
  );
}
