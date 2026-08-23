"use client";

import { ExternalLink, FileText, FileType2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KnowledgeMarkdown } from "@/components/knowledge/KnowledgeMarkdown";
import { cn } from "@/lib/utils";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function PreviewKnowledgeDialog({ document, open, onOpenChange }) {
  if (!document) return null;

  const isPdf = document.type === "PDF";
  const fileUrl = document.fileUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[var(--color-border)] px-5 py-4 text-left">
          <div className="flex items-start gap-3 pr-8">
            <span
              className={cn(
                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
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
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">
                {document.name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {document.type === "WEB"
                  ? `Website · ${document.origin || "embed"} · Saved ${formatDate(document.createdAt)}`
                  : `${document.type} · Added ${formatDate(document.createdAt)}${isPdf ? " · Extracted text used in chat" : ""}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-4 sm:p-5">
            {document.content ? (
              <KnowledgeMarkdown content={document.content} />
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Body not loaded in admin inspect (metadata only). Use the
                customer workspace to edit full knowledge text
                {fileUrl ? ", or open the original file." : "."}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-[var(--color-border)] px-5 py-3 sm:justify-between">
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
              Open original PDF
            </a>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
