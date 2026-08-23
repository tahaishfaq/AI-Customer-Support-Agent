"use client";

import { useState } from "react";
import { Eye, ExternalLink, FileText, FileType2, Globe, Trash2 } from "lucide-react";
import { DeleteKnowledgeDialog } from "@/components/knowledge/DeleteKnowledgeDialog";
import { PreviewKnowledgeDialog } from "@/components/knowledge/PreviewKnowledgeDialog";
import { isLargeKnowledgeDoc } from "@/lib/services/ai/knowledge-retrieve";
import { cn } from "@/lib/utils";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
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
  const isWeb = document.type === "WEB";
  const fileUrl = document.fileUrl;
  const large = isLargeKnowledgeDoc(document);

  return (
    <>
      <article className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5 last:border-b-0">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              isPdf
                ? "bg-[var(--color-info)]/10 text-[var(--color-info)]"
                : isWeb
                  ? "bg-teal-50 text-[var(--color-primary)]"
                  : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
            )}
          >
            {isPdf ? (
              <FileType2 className="size-4" />
            ) : isWeb ? (
              <Globe className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-[var(--color-text)]">
                {document.name}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isPdf
                    ? "bg-[var(--color-info)]/10 text-[var(--color-info)]"
                    : isWeb
                      ? "bg-teal-50 text-[var(--color-primary)]"
                      : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                )}
              >
                {isWeb ? "Website" : document.type}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
              {isWeb && document.origin
                ? `${document.origin.replace(/^https?:\/\//, "")} · ${formatDate(document.createdAt)}`
                : formatDate(document.createdAt)}
              {large ? " · Large — relevant sections used in chat" : ""}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-3" />
            Preview
          </button>
          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              <ExternalLink className="size-3" />
              Open PDF
            </a>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3" />
            Delete
          </button>
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
