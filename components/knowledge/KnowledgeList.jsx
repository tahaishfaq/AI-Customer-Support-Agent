"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { listKnowledge } from "@/lib/api/knowledge";
import { KnowledgeItem } from "@/components/knowledge/KnowledgeItem";
import { AddTextKnowledgeDialog } from "@/components/knowledge/AddTextKnowledgeDialog";
import { UploadPdfKnowledge } from "@/components/knowledge/UploadPdfKnowledge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function KnowledgeList({ agentId, siteCrawledAt, siteKnowledgeOrigin }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [textOpen, setTextOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listKnowledge(agentId);
      setDocuments(data);
    } catch (err) {
      setError(err.message || "Unable to load knowledge");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          FAQ text, PDFs, and website pages this agent can use.
          {siteCrawledAt
            ? ` Website knowledge saved from ${String(siteKnowledgeOrigin || "").replace(/^https?:\/\//, "") || "embed"} on ${new Date(siteCrawledAt).toLocaleDateString()}.`
            : " Embed the widget on a live https site to learn public help pages once."}
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

      {error ? (
        <div className="mt-4 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 text-sm font-medium text-[var(--color-primary)] underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {documents.length === 0 && !error ? (
        <div className="hapy-card mt-4 px-6 py-12 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <BookOpen className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-[var(--color-text)]">
            No knowledge yet. Add FAQ text, upload a PDF, or embed the widget on
            your site.
          </p>
        </div>
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
