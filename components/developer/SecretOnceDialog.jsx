"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Shows a new key / signing secret once. It is never shown again after this dialog closes. */
export function SecretOnceDialog({ secret, title, description, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed — select the text and copy it manually");
    }
  }

  return (
    <Dialog open={Boolean(secret)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">{secret}</code>
          <Button type="button" size="sm" variant="outline" onClick={copy} aria-label="Copy to clipboard">
            <Copy className="size-3.5" aria-hidden /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Store it somewhere safe now. For your security it will not be shown again.
        </p>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            I&apos;ve saved it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
