"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { listAgentTraces, getAgentTrace } from "@/lib/api/traces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function turnTone(status) {
  const s = String(status || "").toUpperCase();
  if (s === "COMPLETED" || s === "OK") return "ok";
  if (s === "FAILED" || s === "ERROR" || s === "ABORTED") return "err";
  if (s === "RUNNING" || s === "PENDING") return "warn";
  return "muted";
}

function toneClass(tone) {
  if (tone === "ok") return "border-emerald-500/40 bg-emerald-500/5";
  if (tone === "err") return "border-destructive/40 bg-destructive/5";
  if (tone === "warn") return "border-amber-500/40 bg-amber-500/5";
  return "border-border bg-card";
}

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function durationLabel(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt) - new Date(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Owner Agent Trace — reconstruct turns without provider bodies / secrets.
 */
export function StudioAgentTraces({ agentId, conversationId = null }) {
  const [turns, setTurns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [trace, setTrace] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const refreshList = useCallback(async () => {
    if (!agentId) return;
    setLoadingList(true);
    setError("");
    try {
      const rows = await listAgentTraces(agentId, {
        conversationId: conversationId || undefined,
        take: 30,
      });
      setTurns(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || "Unable to load traces");
    } finally {
      setLoadingList(false);
    }
  }, [agentId, conversationId]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  async function openTurn(turnId) {
    if (!agentId || !turnId) return;
    if (selectedId === turnId) {
      setSelectedId(null);
      setTrace(null);
      return;
    }
    setSelectedId(turnId);
    setLoadingDetail(true);
    setError("");
    try {
      const detail = await getAgentTrace(agentId, turnId);
      setTrace(detail);
    } catch (err) {
      setTrace(null);
      setError(err.message || "Unable to load turn trace");
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground">Agent Trace</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Reconstruct a turn: activity phases, tools, message previews. No
            provider bodies or secrets.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={refreshList}
          disabled={loadingList}
        >
          {loadingList ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="shrink-0 text-xs text-destructive">{error}</p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <ScrollArea className="min-h-[200px] rounded-xl border border-border">
          <ul className="space-y-1.5 p-2">
            {!turns.length && !loadingList ? (
              <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                No TurnRun rows yet. Send a studio or embed message first.
              </li>
            ) : null}
            {turns.map((turn) => {
              const tone = turnTone(turn.status);
              const selected = selectedId === turn.id;
              const dur = durationLabel(turn.startedAt, turn.finishedAt);
              return (
                <li key={turn.id}>
                  <button
                    type="button"
                    onClick={() => openTurn(turn.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      toneClass(tone),
                      selected && "ring-2 ring-ring/40"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className="h-5 px-1.5 text-[10px] font-normal"
                      >
                        {turn.status || "UNKNOWN"}
                      </Badge>
                      {turn.errorCode ? (
                        <span className="text-[10px] text-destructive">
                          {turn.errorCode}
                        </span>
                      ) : null}
                      {dur ? (
                        <span className="text-[10px] text-muted-foreground">
                          {dur}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {turn.id}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatWhen(turn.startedAt || turn.createdAt)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        <ScrollArea className="min-h-[200px] rounded-xl border border-border">
          <div className="space-y-3 p-3">
            {loadingDetail ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner className="size-3.5" /> Loading timeline…
              </div>
            ) : null}
            {!selectedId && !loadingDetail ? (
              <div className="flex flex-col items-center gap-2 px-2 py-10 text-center text-xs text-muted-foreground">
                <Activity className="size-5 opacity-50" />
                Select a turn to reconstruct its timeline.
              </div>
            ) : null}
            {trace ? (
              <>
                <div>
                  <p className="text-[11px] font-medium">Turn</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {trace.turn?.id} · {trace.turn?.status}
                    {trace.turn?.requestId
                      ? ` · req ${trace.turn.requestId}`
                      : ""}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Reconstructed · provider bodies excluded
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium">Activity</p>
                  <ol className="space-y-1.5">
                    {(trace.activities || []).map((a) => (
                      <li
                        key={`${a.activityId}-${a.sequence}`}
                        className="rounded-md border border-border px-2 py-1.5 text-[11px]"
                      >
                        <span className="font-medium">{a.label || a.phase}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {a.phase}
                          {a.durationMs != null ? ` · ${a.durationMs}ms` : ""}
                          {a.errorCode ? ` · ${a.errorCode}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium">Tools</p>
                  {(trace.toolRuns || []).length ? (
                    <ul className="space-y-1.5">
                      {trace.toolRuns.map((run) => (
                        <li
                          key={run.id}
                          className="rounded-md border border-border px-2 py-1.5 font-mono text-[10px]"
                        >
                          {run.actionName || "tool"} · {run.status}
                          {run.httpStatus != null ? ` · HTTP ${run.httpStatus}` : ""}
                          {run.durationMs != null ? ` · ${run.durationMs}ms` : ""}
                          {run.policyOutcome ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              {" "}
                              · policy {run.policyOutcome}
                            </span>
                          ) : run.errorCode ? (
                            ` · ${run.errorCode}`
                          ) : (
                            ""
                          )}
                          {run.confirmationRequired ? " · needs confirm" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      No tool runs in this window.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium">Messages (preview)</p>
                  <ul className="space-y-1.5">
                    {(trace.messages || []).map((m) => (
                      <li
                        key={m.id}
                        className="rounded-md border border-border px-2 py-1.5 text-[11px]"
                      >
                        <span className="font-medium">{m.role}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {m.contentPreview || "(empty)"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
