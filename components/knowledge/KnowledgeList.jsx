"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { listKnowledge } from "@/lib/api/knowledge";
import { KnowledgeItem } from "@/components/knowledge/KnowledgeItem";
import { AddTextKnowledgeDialog } from "@/components/knowledge/AddTextKnowledgeDialog";
import { UploadPdfKnowledge } from "@/components/knowledge/UploadPdfKnowledge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function KnowledgeList({ agentId }) {
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
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton
            key={i}
            className="h-28 w-full rounded-2xl bg-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          className="gap-2"
          onClick={() => setTextOpen(true)}
        >
          <Plus className="size-4" />
          Add Text / FAQ
        </Button>
        <UploadPdfKnowledge agentId={agentId} onUploaded={handleCreated} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3">
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
        <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <BookOpen className="size-6" />
          </span>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-text)]">
            No knowledge yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
            Add FAQ text or upload a PDF so your agent has information to use.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
