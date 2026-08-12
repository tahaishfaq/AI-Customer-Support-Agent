"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAgent } from "@/lib/api/agents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteAgentDialog({
  agent,
  open,
  onOpenChange,
  redirectTo = "/agents",
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!agent?.id) return;
    setLoading(true);
    setError("");
    try {
      await deleteAgent(agent.id);
      onOpenChange?.(false);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err.message || "Unable to delete agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete agent?</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <span className="font-medium text-[var(--color-text)]">
              {agent?.name}
            </span>{" "}
            and its related knowledge and conversations.
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
