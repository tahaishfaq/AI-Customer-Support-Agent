"use client";

import { useState } from "react";
import { deleteKnowledge } from "@/lib/api/knowledge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteKnowledgeDialog({
  document,
  open,
  onOpenChange,
  onDeleted,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!document?.id) return;
    setLoading(true);
    setError("");
    try {
      await deleteKnowledge(document.id);
      onOpenChange?.(false);
      onDeleted?.(document.id);
    } catch (err) {
      setError(err.message || "Unable to delete document");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete knowledge?</DialogTitle>
          <DialogDescription>
            This will permanently remove{" "}
            <span className="font-medium text-[var(--color-text)]">
              {document?.name}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange?.(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading}
            onClick={handleDelete}
          >
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
