"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function SystemPromptExpandDialog({
  open,
  onOpenChange,
  value,
  onChange,
  disabled = false,
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  function handleSave() {
    onChange?.(draft);
    onOpenChange?.(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(720px,90dvh)] w-[min(42rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>System prompt</DialogTitle>
          <DialogDescription>
            Full role and personality instructions. Grounding and safety rules are
            still appended automatically at reply time.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 px-6 py-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            className="h-full min-h-[min(480px,55dvh)] resize-none font-mono text-sm leading-relaxed"
            placeholder="You are a helpful support assistant for this business…"
          />
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-border bg-card px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onOpenChange?.(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={disabled} onClick={handleSave}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
