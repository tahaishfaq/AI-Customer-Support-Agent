"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FileText, FileType2, Globe } from "lucide-react";
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
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!document) return null;

  const isPdf = document.type === "PDF";
  const isWeb = document.type === "WEB";
  const fileUrl = document.fileUrl;
  const sourceUrl = String(document.sourceUrl || "").trim();
  const body = String(document.content || "");
  const charCount = body.length;
  const thinShell =
    isWeb &&
    charCount > 0 &&
    charCount < 120 &&
    /create-react-app|vite|next\.js|#root/i.test(body);

  async function copyFull() {
    if (!body || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRaw(false);
        onOpenChange?.(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-[var(--color-border)] px-5 py-4 text-left">
          <div className="flex items-start gap-3 pr-8">
            <span
              className={cn(
                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
                isPdf
                  ? "bg-[var(--color-info)]/10 text-[var(--color-info)]"
                  : isWeb
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              )}
            >
              {isPdf ? (
                <FileType2 className="size-5" />
              ) : isWeb ? (
                <Globe className="size-5" />
              ) : (
                <FileText className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base leading-snug break-words">
                {document.name}
              </DialogTitle>
              <DialogDescription className="mt-1 space-y-1">
                <span className="block">
                  {isWeb
                    ? `Website · ${document.origin || "embed"} · Saved ${formatDate(document.createdAt)}`
                    : `${document.type} · Added ${formatDate(document.createdAt)}${isPdf ? " · Extracted text used in chat" : ""}`}
                </span>
                <span className="block text-[11px] tabular-nums">
                  Full indexed text · {charCount.toLocaleString()} characters
                  {thinShell
                    ? " · Thin SPA shell (likely create-react-app / empty #root)"
                    : ""}
                </span>
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-[var(--color-primary)] underline underline-offset-2"
                  >
                    <ExternalLink className="size-3 shrink-0" />
                    {sourceUrl}
                  </a>
                ) : null}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-5 py-2">
          <Button
            type="button"
            size="sm"
            variant={raw ? "outline" : "secondary"}
            onClick={() => setRaw(false)}
          >
            Formatted
          </Button>
          <Button
            type="button"
            size="sm"
            variant={raw ? "secondary" : "outline"}
            onClick={() => setRaw(true)}
          >
            Raw text
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto gap-1.5"
            disabled={!body}
            onClick={copyFull}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy full text"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/80 p-4 sm:p-5">
            {body ? (
              raw ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-[var(--color-text)]">
                  {body}
                </pre>
              ) : (
                <KnowledgeMarkdown content={body} />
              )
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No indexed text for this document
                {fileUrl ? " — open the original file if available." : "."}
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
