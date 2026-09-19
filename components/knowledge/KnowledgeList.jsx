"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { KnowledgeItem } from "@/components/knowledge/KnowledgeItem";
import { AddTextKnowledgeDialog } from "@/components/knowledge/AddTextKnowledgeDialog";
import { UploadPdfKnowledge } from "@/components/knowledge/UploadPdfKnowledge";
import { CrawlSchedulePanel } from "@/components/knowledge/CrawlSchedulePanel";
import { WebSearchPanel } from "@/components/knowledge/WebSearchPanel";
import { listKnowledge, retrySiteCrawl } from "@/lib/api/knowledge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { LARGE_DOC_CHARS, isLargeKnowledgeDoc } from "@/lib/services/ai/knowledge-retrieve";
import { queryKeys } from "@/lib/query/keys";
import { invalidateKnowledgeQuery } from "@/lib/query/invalidation";

function CrawlStatusBadge({ status }) {
  if (!status) return null;
  const styles = {
    FAILED:
      "border-destructive/30 bg-destructive/10 text-destructive",
    QUEUED:
      "border-border bg-muted text-muted-foreground",
    RUNNING:
      "border-primary/30 bg-primary/10 text-primary",
    DONE: "border-border bg-muted text-muted-foreground",
  };
  const label = {
    FAILED: "Crawl failed",
    QUEUED: "Crawl queued",
    RUNNING: "Crawling…",
    DONE: "Crawl done",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles[status] || styles.QUEUED}`}
    >
      {label[status] || status}
    </span>
  );
}

export function KnowledgeList({
  agentId,
  siteCrawledAt,
  siteKnowledgeOrigin,
  crawlRecrawlHours = 0,
  webSearchEnabled = false,
  onCrawlScheduleChange,
  onWebSearchChange,
}) {
  const [textOpen, setTextOpen] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [homepageUrl, setHomepageUrl] = useState("");
  const queryClient = useQueryClient();
  const knowledgeQuery = useQuery({
    queryKey: queryKeys.knowledge.list(agentId),
    queryFn: () => listKnowledge(agentId),
    enabled: Boolean(agentId),
    refetchInterval: (query) => {
      const status = query.state.data?.latestCrawl?.status;
      return status === "QUEUED" || status === "RUNNING" ? 3000 : false;
    },
  });
  const documents = knowledgeQuery.data?.documents || [];
  const latestCrawl = knowledgeQuery.data?.latestCrawl || null;
  const loading = knowledgeQuery.isPending;
  const error = knowledgeQuery.error?.message || "";

  const crawlActive =
    latestCrawl?.status === "QUEUED" || latestCrawl?.status === "RUNNING";

  const suggestedOrigin =
    siteKnowledgeOrigin || latestCrawl?.origin || "";

  useEffect(() => {
    if (latestCrawl?.status !== "FAILED") return;
    if (homepageUrl.trim()) return;
    if (suggestedOrigin) setHomepageUrl(suggestedOrigin);
  }, [latestCrawl?.status, suggestedOrigin, homepageUrl]);

  const canRetryCrawl = latestCrawl?.status === "FAILED" && !crawlActive;
  const retryOriginReady = Boolean(
    homepageUrl.trim() || suggestedOrigin
  );

  async function handleRetryCrawl() {
    if (retryBusy || !canRetryCrawl) return;
    const url = homepageUrl.trim() || suggestedOrigin;
    if (!url) {
      toast.error("Enter your site homepage URL (https://…)");
      return;
    }
    setRetryBusy(true);
    try {
      const result = await retrySiteCrawl(agentId, { homepageUrl: url });
      queryClient.setQueryData(queryKeys.knowledge.list(agentId), (previous) => ({
        ...(previous || { documents: [] }),
        latestCrawl: result.latestCrawl || {
          id: result.jobId,
          status: "QUEUED",
          error: null,
          origin: result.origin,
          finishedAt: null,
        },
      }));
      toast.success("Website crawl queued");
      void invalidateKnowledgeQuery(queryClient, agentId);
    } catch (err) {
      toast.error(err.message || "Unable to retry crawl");
    } finally {
      setRetryBusy(false);
    }
  }

  function handleCreated() {
    void invalidateKnowledgeQuery(queryClient, agentId);
  }

  function handleDeleted(id) {
    queryClient.setQueryData(queryKeys.knowledge.list(agentId), (previous) => ({
      ...(previous || { latestCrawl: null }),
      documents: (previous?.documents || []).filter((doc) => doc.id !== id),
    }));
    void invalidateKnowledgeQuery(queryClient, agentId);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const hasWeb = documents.some((d) => d.type === "WEB");
  const hasLargeDoc = documents.some((d) => isLargeKnowledgeDoc(d));

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          FAQ text, PDFs, and website pages this agent can use.
          {hasWeb && siteCrawledAt
            ? ` Website knowledge saved from ${String(siteKnowledgeOrigin || "").replace(/^https?:\/\//, "") || "embed"} on ${new Date(siteCrawledAt).toLocaleDateString()}.`
            : " Embed the widget on a live https site to learn public pages once. Set a re-crawl schedule below to refresh website knowledge automatically."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => setTextOpen(true)}
          >
            <Plus className="size-3.5" />
            Add Text / FAQ
          </Button>
          <UploadPdfKnowledge agentId={agentId} onUploaded={handleCreated} />
        </div>
      </div>

      {hasLargeDoc ? (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
          Large document — chat uses the most relevant sections, not the whole
          file (over {LARGE_DOC_CHARS.toLocaleString()} characters).
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        <WebSearchPanel
          agentId={agentId}
          webSearchEnabled={webSearchEnabled}
          onSaved={onWebSearchChange}
        />

        <CrawlSchedulePanel
          agentId={agentId}
          crawlRecrawlHours={crawlRecrawlHours}
          siteCrawledAt={siteCrawledAt}
          siteKnowledgeOrigin={siteKnowledgeOrigin}
          hasWeb={hasWeb}
          onSaved={onCrawlScheduleChange}
          variant="panel"
        />
      </div>

      {latestCrawl?.status === "FAILED" ? (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <CrawlStatusBadge status="FAILED" />
            <p className="text-sm font-medium text-destructive">
              Website crawl failed
            </p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {(latestCrawl.error || "")
              .replace(/^CRAWL_FAILED:\s*/i, "")
              .trim() || "The one-time site crawl could not finish."}{" "}
            Enter your public homepage URL and we will crawl that site’s public
            pages (login, account, and admin paths are skipped).
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://yoursite.com"
              value={homepageUrl}
              onChange={(event) => setHomepageUrl(event.target.value)}
              disabled={retryBusy}
              className="sm:max-w-md"
              aria-label="Site homepage URL"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canRetryCrawl || !retryOriginReady || retryBusy}
              onClick={() => void handleRetryCrawl()}
            >
              {retryBusy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Crawl site
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Must be a public https site. Localhost is not allowed — use your
            deployed domain (for local testing, enter any public https URL).
          </p>
        </div>
      ) : null}

      {crawlActive ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
          <CrawlStatusBadge status={latestCrawl.status} />
          <p className="text-sm text-muted-foreground">
            Website crawl{" "}
            {latestCrawl.status === "RUNNING" ? "in progress" : "queued"}
            {latestCrawl.origin ? ` for ${latestCrawl.origin}` : ""}. This page
            refreshes automatically.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => knowledgeQuery.refetch()}
            className="mt-2 text-sm font-medium text-primary underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {documents.length === 0 && !error ? (
        <EmptyState
          className="mt-4"
          icon={BookOpen}
          title={
            crawlActive
              ? "Website crawl is running"
              : "No knowledge yet"
          }
          description={
            crawlActive
              ? "Sources will appear here when the crawl finishes."
              : "Add FAQ text, upload a PDF, or embed the widget on your site."
          }
          action={
            crawlActive ? null : (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => setTextOpen(true)}
              >
                <Plus className="size-3.5" />
                Add knowledge
              </Button>
            )
          }
        />
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          {documents.map((doc) => (
            <KnowledgeItem
              key={doc.id}
              document={doc}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      <AddTextKnowledgeDialog
        agentId={agentId}
        open={textOpen}
        onOpenChange={setTextOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
