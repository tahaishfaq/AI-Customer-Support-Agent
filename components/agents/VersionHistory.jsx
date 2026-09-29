"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatRelative } from "@/components/conversations/format";
import { getAgentRevision, listAgentRevisions, restoreAgentRevision } from "@/lib/api/agents";
import { queryKeys } from "@/lib/query/keys";

const VISIBLE = 8;

function PromptBlock({ label, text }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 font-sans text-xs leading-relaxed text-foreground">
        {text || "—"}
      </pre>
    </div>
  );
}

/**
 * Level 2 · P5 — saved versions of the agent (prompt, guidance, widget…). Restoring saves the old
 * version as the current settings; nothing in the history is deleted.
 */
export function VersionHistory({ agent, onRestored }) {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [restoreError, setRestoreError] = useState("");

  const historyQuery = useQuery({
    queryKey: queryKeys.agents.revisions(agent.id),
    queryFn: () => listAgentRevisions(agent.id),
  });
  const viewQuery = useQuery({
    queryKey: [...queryKeys.agents.revisions(agent.id), viewing],
    queryFn: () => getAgentRevision(agent.id, viewing),
    enabled: viewing != null,
  });

  const revisions = historyQuery.data?.revisions || [];
  const shown = showAll ? revisions : revisions.slice(0, VISIBLE);

  async function restore() {
    setRestoreError("");
    try {
      const result = await restoreAgentRevision(agent.id, restoring);
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.revisions(agent.id) });
      toast.success(`Restored version ${restoring}`);
      onRestored?.(result.agent);
    } catch (err) {
      setRestoreError(err.message || "Could not restore this version");
      throw err;
    }
  }

  return (
    <section className="aide-card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="versions-heading">
      <div className="flex flex-col gap-1">
        <h2 id="versions-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <History className="size-4" aria-hidden />
          Version history
        </h2>
        <p className="text-xs text-muted-foreground">
          Every saved change to the prompt, guidance, welcome message, web search or widget is kept. Restoring a version
          saves it as the current settings — nothing is deleted.
        </p>
      </div>

      {historyQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading versions…
        </p>
      ) : historyQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {historyQuery.error?.message || "Could not load versions"}
        </p>
      ) : revisions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No versions yet. They appear after you save a change.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {shown.map((revision) => (
            <li key={revision.version} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  Version {revision.version}
                  {revision.live ? (
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      Live
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    formatRelative(revision.createdAt),
                    revision.author,
                    revision.note,
                    revision.changed.length ? `${revision.changed.join(", ")} changed` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setViewing(revision.version)}>
                  View
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={revision.live}
                  onClick={() => {
                    setRestoreError("");
                    setRestoring(revision.version);
                  }}
                >
                  <RotateCcw className="size-3.5" aria-hidden /> Restore
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {revisions.length > VISIBLE ? (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer" : `Show all ${revisions.length} versions`}
        </Button>
      ) : null}

      <Dialog open={viewing != null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Version {viewing}</DialogTitle>
            <DialogDescription>Compare this version&apos;s prompt with the live one.</DialogDescription>
          </DialogHeader>
          {viewQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Loading…
            </p>
          ) : viewQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {viewQuery.error?.message || "Could not load this version"}
            </p>
          ) : viewQuery.data ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <PromptBlock label={`Version ${viewing}`} text={viewQuery.data.snapshot?.systemPrompt} />
                <PromptBlock label="Live now" text={agent.systemPrompt} />
              </div>
              <p className="text-xs text-muted-foreground">
                Guidance rules in this version: {viewQuery.data.snapshot?.guidance?.length || 0} · Web search:{" "}
                {viewQuery.data.snapshot?.webSearchEnabled ? "on" : "off"} · Welcome: “
                {viewQuery.data.snapshot?.welcomeMessage || "—"}”
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={restoring != null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={`Restore version ${restoring}?`}
        description="The prompt, guidance, welcome message, web search and widget settings go back to this version. Your current settings stay in the history, so you can switch back."
        confirmLabel="Restore"
        variant="default"
        error={restoreError}
        onConfirm={restore}
      />
    </section>
  );
}
