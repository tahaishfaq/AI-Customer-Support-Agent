"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  listDocumentShares,
  setDocumentShares,
} from "@/lib/api/knowledge";
import { queryKeys } from "@/lib/query/keys";

export function ShareKnowledgeDialog({
  document,
  open,
  onOpenChange,
  onSaved,
}) {
  const documentId = document?.id;
  const queryClient = useQueryClient();
  const sharesQuery = useQuery({
    queryKey: queryKeys.knowledge.docShares(documentId),
    queryFn: () => listDocumentShares(documentId),
    enabled: Boolean(open && documentId),
  });

  const currentIds = useMemo(
    () =>
      (sharesQuery.data?.shares || [])
        .map((row) => row.consumerAgentId)
        .sort(),
    [sharesQuery.data?.shares]
  );

  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (open) setSelected(new Set(currentIds));
  }, [open, currentIds]);

  const saveMutation = useMutation({
    mutationFn: (consumerAgentIds) =>
      setDocumentShares(documentId, consumerAgentIds),
    onSuccess: (data) => {
      queryClient.setQueryData(
        queryKeys.knowledge.docShares(documentId),
        data
      );
      toast.success("Knowledge shared");
      onSaved?.(data);
      onOpenChange(false);
      // Refresh sibling agent knowledge lists when open
      void queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (err) => {
      toast.error(err.message || "Unable to share knowledge");
    },
  });

  const eligible = sharesQuery.data?.eligibleAgents || [];
  const currentSet = useMemo(() => new Set(currentIds), [currentIds]);
  const dirty =
    selected.size !== currentSet.size ||
    [...selected].some((id) => !currentSet.has(id));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share knowledge</DialogTitle>
          <DialogDescription>
            Pick agents in this workspace that should use “
            {document?.name || "this document"}”. They see a live copy — edits
            here update for them automatically.
          </DialogDescription>
        </DialogHeader>

        {sharesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading agents…</p>
        ) : sharesQuery.error ? (
          <p className="text-sm text-destructive">
            {sharesQuery.error.message || "Unable to load agents"}
          </p>
        ) : eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No other agents in this workspace yet.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {eligible.map((agent) => (
              <li key={agent.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border"
                    checked={selected.has(agent.id)}
                    onChange={() => toggle(agent.id)}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {agent.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!dirty || saveMutation.isPending || eligible.length === 0}
            onClick={() => saveMutation.mutate([...selected])}
          >
            {saveMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
