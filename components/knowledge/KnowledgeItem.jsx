"use client";

import { useState } from "react";
import {
  Eye,
  ExternalLink,
  FileText,
  FileType2,
  Globe,
  Share2,
  Trash2,
  Unlink,
} from "lucide-react";
import { DeleteKnowledgeDialog } from "@/components/knowledge/DeleteKnowledgeDialog";
import { PreviewKnowledgeDialog } from "@/components/knowledge/PreviewKnowledgeDialog";
import { ShareKnowledgeDialog } from "@/components/knowledge/ShareKnowledgeDialog";
import { isLargeKnowledgeDoc } from "@/lib/services/ai/knowledge-retrieve";
import { unshareKnowledgeDocument } from "@/lib/api/knowledge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export function KnowledgeItem({ document, agentId, onDeleted, onUnshared }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [unsharing, setUnsharing] = useState(false);
  const isPdf = document.type === "PDF";
  const isWeb = document.type === "WEB";
  const fileUrl = document.fileUrl;
  const large = isLargeKnowledgeDoc(document);
  const isShared = document.isShared === true;

  async function handleUnshare() {
    if (!agentId || unsharing) return;
    setUnsharing(true);
    try {
      await unshareKnowledgeDocument(agentId, document.id);
      toast.success("Removed shared knowledge");
      onUnshared?.(document.id);
    } catch (err) {
      toast.error(err.message || "Unable to remove shared knowledge");
    } finally {
      setUnsharing(false);
    }
  }

  return (
    <>
      <article className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              isPdf
                ? "bg-sky-500/10 text-sky-700"
                : isWeb
                  ? "bg-primary/10 text-primary"
                  : "bg-primary/10 text-primary"
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
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {document.name}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isPdf
                    ? "bg-sky-500/10 text-sky-700"
                    : isWeb
                      ? "bg-primary/10 text-primary"
                      : "bg-primary/10 text-primary"
                )}
              >
                {isWeb ? "Website" : document.type}
              </span>
              {isShared ? (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Shared from {document.sharedFromAgentName || "another agent"}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {isWeb && document.origin
                ? `${document.origin.replace(/^https?:\/\//, "")} · ${formatDate(document.createdAt)}`
                : formatDate(document.createdAt)}
              {` · ${String(document.content || "").length.toLocaleString()} chars`}
              {large ? " · Large — relevant sections used in chat" : ""}
            </span>
            {String(document.content || "").trim() ? (
              <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground/90">
                {String(document.content).replace(/\s+/g, " ").trim()}
              </span>
            ) : null}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
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
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              Open PDF
            </a>
          ) : null}
          {!isShared ? (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="size-3" />
                Share
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-destructive hover:bg-destructive/5"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3" />
                Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={unsharing}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              onClick={handleUnshare}
            >
              <Unlink className="size-3" />
              Remove
            </button>
          )}
        </div>
      </article>

      <PreviewKnowledgeDialog
        document={document}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      {!isShared ? (
        <>
          <ShareKnowledgeDialog
            document={document}
            open={shareOpen}
            onOpenChange={setShareOpen}
          />
          <DeleteKnowledgeDialog
            document={document}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onDeleted={onDeleted}
          />
        </>
      ) : null}
    </>
  );
}
