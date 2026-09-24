"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { KnowledgeItem } from "@/components/knowledge/KnowledgeItem";
import { AddTextKnowledgeDialog } from "@/components/knowledge/AddTextKnowledgeDialog";
import { UploadPdfKnowledge } from "@/components/knowledge/UploadPdfKnowledge";
import { CrawlSchedulePanel } from "@/components/knowledge/CrawlSchedulePanel";
import { CrawlNowPanel } from "@/components/knowledge/CrawlNowPanel";
import { WebSearchPanel } from "@/components/knowledge/WebSearchPanel";
import { listKnowledge } from "@/lib/api/knowledge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSurface } from "@/components/ui/loading-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { CRAWL_PAGE_KNOWLEDGE_PREFIX } from "@/lib/services/crawl-knowledge";
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

  const crawlDocuments = documents.filter(
    (doc) =>
      doc.type === "WEB" &&
      (String(doc.name || "").startsWith(CRAWL_PAGE_KNOWLEDGE_PREFIX) ||
        Boolean(doc.crawlJobId) ||
        Boolean(doc.origin))
  );
  const crawlIds = new Set(crawlDocuments.map((d) => d.id));
  const manualDocuments = documents.filter((doc) => !crawlIds.has(doc.id));
  const crawlChars = crawlDocuments.reduce(
    (sum, doc) => sum + String(doc.content || "").length,
    0
  );
  const crawlActive =
    latestCrawl?.status === "QUEUED" || latestCrawl?.status === "RUNNING";

  function handleCrawlQueued(result) {
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
    void invalidateKnowledgeQuery(queryClient, agentId);
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
      <LoadingSurface label="Loading knowledge…">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </LoadingSurface>
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

        <CrawlNowPanel
          agentId={agentId}
          siteKnowledgeOrigin={siteKnowledgeOrigin}
          latestCrawl={latestCrawl}
          crawlActive={crawlActive}
          onQueued={handleCrawlQueued}
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
            Use <span className="font-medium">Re-crawl now</span> above with
            public https page URLs (help, pricing, docs). JavaScript-only SPAs
            with an empty HTML shell usually fail — add knowledge manually or
            publish real HTML pages.
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
              : "Add FAQ text, upload a PDF, or use Crawl / re-crawl above with your site URLs."
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
        <div className="mt-4 space-y-4">
          {crawlDocuments.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Website crawl knowledge
                </h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {crawlDocuments.length} document
                  {crawlDocuments.length === 1 ? "" : "s"} ·{" "}
                  {crawlChars.toLocaleString()} characters indexed. Open Preview
                  (or the row) to read the full text the agent can use.
                </p>
              </div>
              {crawlDocuments.map((doc) => (
                <KnowledgeItem
                  key={doc.id}
                  document={doc}
                  onDeleted={handleDeleted}
                />
              ))}
            </section>
          ) : null}

          {manualDocuments.length > 0 ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              {crawlDocuments.length > 0 ? (
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Manual knowledge
                  </h3>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    FAQ text and PDF uploads you added yourself.
                  </p>
                </div>
              ) : null}
              {manualDocuments.map((doc) => (
                <KnowledgeItem
                  key={doc.id}
                  document={doc}
                  onDeleted={handleDeleted}
                />
              ))}
            </section>
          ) : null}
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
