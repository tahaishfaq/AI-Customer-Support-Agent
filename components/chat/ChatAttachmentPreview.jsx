"use client";

import { useState } from "react";
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
import { parseChatAttachment } from "@/lib/utils/chat-attachments";
import { cn } from "@/lib/utils";

function inferMetaFromMarkdown(content) {
  const image = String(content || "").match(/!\[([^\]]*)\]\((https?:[^)]+)\)/);
  if (image) {
    return { kind: "image", name: image[1] || "Image", fileUrl: image[2] };
  }
  const link = String(content || "").match(
    /Attached file:\s*\[([^\]]+)\]\((https?:[^)]+)\)/i
  );
  if (link) {
    const name = link[1] || "File";
    const kind = /\.pdf$/i.test(name) ? "pdf" : "file";
    return { kind, name, fileUrl: link[2] };
  }
  return null;
}

export function ChatAttachmentPreview({ content, themed, isUser }) {
  const parsed = parseChatAttachment(content);
  const meta = parsed.meta || inferMetaFromMarkdown(parsed.display || content);
  const [open, setOpen] = useState(false);

  if (!meta?.fileUrl) return null;

  const isImage = meta.kind === "image";
  const isPdf = meta.kind === "pdf" || /\.pdf$/i.test(meta.name || "");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mt-1 block max-w-full text-left",
          isUser ? "ml-auto" : ""
        )}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meta.fileUrl}
            alt={meta.name || ""}
            className="max-h-40 max-w-full rounded-md object-contain"
          />
        ) : (
          <span
            className={cn(
              "inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium",
              themed
                ? isUser
                  ? "bg-white/15 text-white"
                  : "bg-black/5 text-[var(--wc-shell-fg)]"
                : isUser
                  ? "bg-white/15 text-white"
                  : "bg-[var(--color-bg)] text-[var(--color-text)]"
            )}
          >
            {isPdf ? (
              <FileType2 className="size-4 shrink-0" />
            ) : (
              <FileText className="size-4 shrink-0" />
            )}
            <span className="truncate">{meta.name || "File"}</span>
          </span>
        )}
        <span
          className={cn(
            "mt-1 block text-[10px]",
            isUser
              ? "text-white/70"
              : themed
                ? "text-[var(--wc-muted)]"
                : "text-[var(--color-muted)]"
          )}
        >
          Tap to preview
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-[var(--color-border)] px-5 py-4 text-left">
            <DialogTitle className="truncate pr-8">{meta.name || "File"}</DialogTitle>
            <DialogDescription>
              {isImage ? "Image preview" : isPdf ? "PDF preview" : "File preview"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-[var(--color-bg)]/80 p-4">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.fileUrl}
                alt={meta.name || ""}
                className="mx-auto max-h-[70vh] max-w-full rounded-md object-contain"
              />
            ) : isPdf ? (
              <iframe
                title={meta.name || "PDF"}
                src={meta.fileUrl}
                className="h-[min(70vh,560px)] w-full rounded-md bg-white"
              />
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                Preview is not available for this file type. Open the original
                instead.
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-[var(--color-border)] px-5 py-3 sm:justify-between">
            <a
              href={meta.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <ExternalLink className="size-3.5" />
              Open original
            </a>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
