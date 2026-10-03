"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  listKnowledgeSuggestions,
  refreshKnowledgeSuggestions,
  reviewKnowledgeSuggestion,
} from "@/lib/api/knowledge-suggestions";
import { invalidateKnowledgeQuery } from "@/lib/query/invalidation";
import { queryKeys } from "@/lib/query/keys";

/** Level 3 · L3 — owner review of drafted FAQ gaps. Nothing publishes without Accept. */
export function KnowledgeSuggestionsPanel({ agentId }) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [edits, setEdits] = useState({});

  const query = useQuery({
    queryKey: queryKeys.knowledge.suggestions(agentId),
    queryFn: () => listKnowledgeSuggestions(agentId, { status: "pending" }),
    enabled: Boolean(agentId),
    staleTime: 30_000,
  });

  const suggestions = query.data?.suggestions || [];
  const canApprove = query.data?.canApprove !== false;

  async function refresh() {
    if (!agentId || refreshing) return;
    setRefreshing(true);
    try {
      const result = await refreshKnowledgeSuggestions(agentId);
      await query.refetch();
      toast.success(
        result.created
          ? `${result.created} suggestion${result.created === 1 ? "" : "s"} ready to review`
          : "No new knowledge gaps found"
      );
    } catch (err) {
      toast.error(err.message || "Could not refresh suggestions");
    } finally {
      setRefreshing(false);
    }
  }

  async function review(id, action) {
    setBusyId(id);
    try {
      const edit = edits[id] || {};
      await reviewKnowledgeSuggestion(agentId, id, {
        action,
        title: edit.title,
        draftAnswer: edit.draftAnswer,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.suggestions(agentId) });
      if (action === "accept") {
        invalidateKnowledgeQuery(queryClient, agentId);
        toast.success("Published to knowledge");
      } else {
        toast.success("Suggestion dismissed");
      }
    } catch (err) {
      toast.error(err.message || "Could not update suggestion");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="aide-card flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="gap-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Lightbulb className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 id="gap-heading" className="text-sm font-semibold text-foreground">
              Knowledge gaps
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Draft FAQs from unanswered questions and human desk replies. Review before anything is
              published.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={refreshing || !canApprove}>
          {refreshing ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
          Scan gaps
        </Button>
      </div>

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : suggestions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No pending suggestions.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suggestions.map((row) => {
            const edit = edits[row.id] || {};
            return (
              <li key={row.id} className="rounded-xl border border-border bg-muted/30 p-3">
                {row.conflictWithDocumentId ? (
                  <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Conflicts with existing knowledge — review carefully before publishing.
                  </p>
                ) : null}
                <Input
                  className="h-9"
                  value={edit.title ?? row.title}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [row.id]: { ...current[row.id], title: event.target.value },
                    }))
                  }
                  disabled={!canApprove}
                  aria-label="Suggestion title"
                />
                <Textarea
                  className="mt-2 min-h-24"
                  value={edit.draftAnswer ?? row.draftAnswer}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [row.id]: { ...current[row.id], draftAnswer: event.target.value },
                    }))
                  }
                  disabled={!canApprove}
                  aria-label="Draft answer"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {canApprove ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => review(row.id, "accept")}
                      >
                        Accept & publish
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === row.id}
                        onClick={() => review(row.id, "dismiss")}
                      >
                        Dismiss
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      View only — Owner/Admin can approve.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
