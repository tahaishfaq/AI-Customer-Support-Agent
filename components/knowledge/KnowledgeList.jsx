"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { listKnowledge } from "@/lib/api/knowledge";
import { updateAgent } from "@/lib/api/agents";
import { KnowledgeItem } from "@/components/knowledge/KnowledgeItem";
import { AddTextKnowledgeDialog } from "@/components/knowledge/AddTextKnowledgeDialog";
import { UploadPdfKnowledge } from "@/components/knowledge/UploadPdfKnowledge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LARGE_DOC_CHARS, isLargeKnowledgeDoc } from "@/lib/services/ai/knowledge-retrieve";
import {
  CRAWL_RECRAWL_OPTIONS,
  labelForCrawlRecrawlHours,
  nextRecrawlAt,
} from "@/lib/services/crawl-schedule";
import { toast } from "sonner";

function CrawlStatusBadge({ status }) {
  if (!status) return null;
  const styles = {
    FAILED:
      "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
    QUEUED:
      "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
    RUNNING:
      "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
    DONE: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
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

function CrawlSchedulePanel({
  agentId,
  crawlRecrawlHours,
  siteCrawledAt,
  siteKnowledgeOrigin,
  hasWeb,
  onSaved,
}) {
  const [value, setValue] = useState(crawlRecrawlHours ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(crawlRecrawlHours ?? 0);
  }, [crawlRecrawlHours]);

  const nextAt =
    hasWeb && value > 0
      ? nextRecrawlAt({ crawlRecrawlHours: value, siteCrawledAt })
      : null;

  async function save() {
    setSaving(true);
    try {
      await updateAgent(agentId, { crawlRecrawlHours: value });
      onSaved?.(value);
      toast.success("Website crawl schedule saved");
    } catch (err) {
      toast.error(err.message || "Unable to save crawl schedule");
    } finally {
      setSaving(false);
    }
  }

  const changed = value !== (crawlRecrawlHours ?? 0);

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Website re-crawl schedule
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            By default the widget crawls your site once when first embedded.
            Choose an interval to refresh website knowledge automatically when
            visitors load the widget.
          </p>
          {hasWeb && value > 0 && siteCrawledAt ? (
            <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
              Last crawl{" "}
              {new Date(siteCrawledAt).toLocaleString()}
              {siteKnowledgeOrigin
                ? ` from ${String(siteKnowledgeOrigin).replace(/^https?:\/\//, "")}`
                : ""}
              . Next eligible recrawl
              {nextAt ? ` after ${nextAt.toLocaleString()}` : " when interval passes"}.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)]"
            aria-label="Website re-crawl interval"
          >
            {CRAWL_RECRAWL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={!changed || saving}
            onClick={save}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
      {value > 0 ? (
        <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
          Scheduled: {labelForCrawlRecrawlHours(value)}. Recrawl runs on the next
          widget ping after the interval — no extra setup needed.
        </p>
      ) : null}
    </div>
  );
}

export function KnowledgeList({
  agentId,
  siteCrawledAt,
  siteKnowledgeOrigin,
  crawlRecrawlHours = 0,
  onCrawlScheduleChange,
}) {
  const [documents, setDocuments] = useState([]);
  const [latestCrawl, setLatestCrawl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [textOpen, setTextOpen] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await listKnowledge(agentId);
      setDocuments(data.documents);
      setLatestCrawl(data.latestCrawl);
    } catch (err) {
      if (!quiet) {
        setError(err.message || "Unable to load knowledge");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

  const crawlActive =
    latestCrawl?.status === "QUEUED" || latestCrawl?.status === "RUNNING";

  useEffect(() => {
    if (!crawlActive) return undefined;
    const timer = setInterval(() => {
      load({ quiet: true });
    }, 3000);
    return () => clearInterval(timer);
  }, [crawlActive, load]);

  function handleCreated(doc) {
    setDocuments((prev) => [doc, ...prev]);
  }

  function handleDeleted(id) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-16 w-full rounded-xl bg-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  const hasWeb = documents.some((d) => d.type === "WEB");
  const hasLargeDoc = documents.some((d) => isLargeKnowledgeDoc(d));

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
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
        <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[13px] text-[var(--color-text-secondary)]">
          Large document — chat uses the most relevant sections, not the whole
          file (over {LARGE_DOC_CHARS.toLocaleString()} characters).
        </p>
      ) : null}

      <CrawlSchedulePanel
        agentId={agentId}
        crawlRecrawlHours={crawlRecrawlHours}
        siteCrawledAt={siteCrawledAt}
        siteKnowledgeOrigin={siteKnowledgeOrigin}
        hasWeb={hasWeb}
        onSaved={onCrawlScheduleChange}
      />

      {latestCrawl?.status === "FAILED" ? (
        <div className="mt-4 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <CrawlStatusBadge status="FAILED" />
            <p className="text-sm font-medium text-[var(--color-danger)]">
              Website crawl failed
            </p>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {(latestCrawl.error || "")
              .replace(/^CRAWL_FAILED:\s*/i, "")
              .trim() || "The one-time site crawl could not finish."}{" "}
            Embed again on your live https origin to retry.
          </p>
        </div>
      ) : null}

      {crawlActive ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <CrawlStatusBadge status={latestCrawl.status} />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Website crawl{" "}
            {latestCrawl.status === "RUNNING" ? "in progress" : "queued"}
            {latestCrawl.origin ? ` for ${latestCrawl.origin}` : ""}. This page
            refreshes automatically.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-2 text-sm font-medium text-[var(--color-primary)] underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {documents.length === 0 && !error ? (
        <EmptyState
          className="mt-4 border-solid shadow-[var(--shadow-card)]"
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
        <div className="hapy-card mt-4 overflow-hidden">
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
