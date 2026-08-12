"use client";

import { useState } from "react";
import { Eye, ExternalLink, FileText, FileType2, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DeleteKnowledgeDialog } from "@/components/knowledge/DeleteKnowledgeDialog";
import { PreviewKnowledgeDialog } from "@/components/knowledge/PreviewKnowledgeDialog";
import { cn } from "@/lib/utils";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function KnowledgeItem({ document, onDeleted }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isPdf = document.type === "PDF";
  const fileUrl = document.fileUrl;

  return (
    <>
      <article className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex min-w-0 flex-1 gap-3 rounded-xl text-left transition hover:bg-[var(--color-bg)]/80"
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              isPdf
                ? "bg-[var(--color-info)]/10 text-[var(--color-info)]"
                : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            )}
          >
            {isPdf ? (
              <FileType2 className="size-5" />
            ) : (
              <FileText className="size-5" />
            )}
          </span>
          <div className="min-w-0 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold text-[var(--color-text)]">
                {document.name}
              </h3>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  isPdf
                    ? "bg-[var(--color-info)]/10 text-[var(--color-info)]"
                    : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                )}
              >
                {document.type}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
              {document.content}
            </p>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Added {formatDate(document.createdAt)} · Click to preview
            </p>
          </div>
        </button>

        <div className="flex flex-wrap gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-3.5" />
            Preview
          </Button>
          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5"
              )}
            >
              <ExternalLink className="size-3.5" />
              Open PDF
            </a>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-[var(--color-danger)]"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </article>

      <PreviewKnowledgeDialog
        document={document}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      <DeleteKnowledgeDialog
        document={document}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}
