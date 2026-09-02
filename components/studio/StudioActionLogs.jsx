"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { listAgentToolRuns } from "@/lib/api/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function statusTone(status, errorCode) {
  const s = String(status || "").toUpperCase();
  if (s === "OK" || s === "SUCCESS") return "ok";
  if (
    s === "ERROR" ||
    s === "TIMEOUT" ||
    s === "SSRF_BLOCKED" ||
    s === "SCHEMA_INVALID" ||
    errorCode
  ) {
    return "err";
  }
  if (s === "PENDING" || s === "CONFIRMATION_REQUIRED") return "warn";
  return "muted";
}

export function explainIssue(entry) {
  const code = String(entry.errorCode || "").toUpperCase();
  const status = String(entry.status || "").toUpperCase();
  if (code === "IDENTITY_REQUIRED" || code === "END_USER_TOKEN_REQUIRED") {
    return "Identity / end-user token missing — tool was not called on the backend.";
  }
  if (code === "CONFIRMATION_REQUIRED") {
    return "Waiting for Confirm in chat — outbound request not sent yet.";
  }
  if (code === "CREDENTIAL_MISSING" || code === "CREDENTIAL_REVOKED") {
    return "Credential issue — server refused to call the tool.";
  }
  if (code === "SSRF_BLOCKED" || status === "SSRF_BLOCKED") {
    return "URL blocked by SSRF / frozen host — request never left Aide.";
  }
  if (code === "TIMEOUT" || status === "TIMEOUT") {
    return "Backend timed out — request may have been sent but no timely response.";
  }
  if (code === "FETCH_ERROR" || code === "CONCURRENCY_LIMIT") {
    return "Outbound call failed before a clean HTTP response.";
  }
  if (entry.httpStatus >= 500) {
    return "Backend returned 5xx — request reached the server but failed.";
  }
  if (entry.httpStatus >= 400) {
    return "Backend returned 4xx — request reached the server; check args/auth.";
  }
  if (status === "OK" && entry.kind === "tool") {
    return "Tool call completed — server consumed the request.";
  }
  if (entry.kind === "knowledge" && entry.count === 0) {
    return "No knowledge chunks retrieved for this turn.";
  }
  if (entry.kind === "chat_error") {
    return entry.message || "Chat request failed before a full reply.";
  }
  if (entry.kind === "chat" && entry.degraded) {
    return "AI degraded reply — message saved but LLM/tools may have failed.";
  }
  return null;
}

function SessionRow({ entry, selected = false, onSelect }) {
  const tone = statusTone(entry.status, entry.errorCode);
  const issue = explainIssue(entry);
  const interactive = typeof onSelect === "function";
  const title =
    entry.kind === "knowledge"
      ? "Knowledge retrieval"
      : entry.kind === "chat_error"
        ? "Chat error"
        : entry.kind === "chat"
          ? "Chat turn"
          : entry.name || entry.actionName || "tool";
  const timeLabel =
    entry.at || entry.createdAt
      ? new Date(entry.at || entry.createdAt).toLocaleTimeString()
      : "";

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(entry, issue)}
        disabled={!interactive}
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-left text-xs transition-colors",
          tone === "err" && "border-destructive/30 bg-destructive/5",
          tone === "warn" && "border-amber-500/30 bg-amber-500/5",
          tone === "ok" && "border-emerald-500/25 bg-emerald-500/5",
          tone === "muted" && "border-border bg-card",
          interactive && "cursor-pointer hover:border-primary/40 hover:bg-muted/40",
          selected && "ring-2 ring-primary/50"
        )}
      >
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <span className="truncate font-medium text-foreground">{title}</span>
          {timeLabel ? (
            <span className="text-[10px] text-muted-foreground sm:text-right">
              {timeLabel}
            </span>
          ) : null}

          <div className="col-span-full flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {entry.status ? (
              <Badge variant="outline" className="rounded-full text-[10px]">
                {entry.status}
              </Badge>
            ) : null}
            {entry.httpStatus != null ? (
              <Badge variant="secondary" className="rounded-full text-[10px]">
                HTTP {entry.httpStatus}
              </Badge>
            ) : null}
            {entry.errorCode ? (
              <Badge variant="destructive" className="rounded-full text-[10px]">
                {entry.errorCode}
              </Badge>
            ) : null}
            {entry.durationMs != null ? (
              <span className="text-[10px] text-muted-foreground">
                {entry.durationMs}ms
              </span>
            ) : null}
            {entry.requestId ? (
              <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
                req {entry.requestId}
              </span>
            ) : null}
          </div>

          {entry.kind === "knowledge" ? (
            <p className="col-span-full text-[11px] text-muted-foreground">
              {entry.count === 0
                ? "0 chunks"
                : `${entry.count} chunk${entry.count === 1 ? "" : "s"}: ${(entry.titles || []).slice(0, 4).join(" · ")}${
                    (entry.titles || []).length > 4 ? "…" : ""
                  }`}
            </p>
          ) : null}
          {issue ? (
            <p className="col-span-full line-clamp-2 text-[11px] leading-snug text-foreground/90">
              {issue}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  );
}

/**
 * Developer action / retrieval logs for Test Studio.
 */
export function StudioActionLogs({
  agentId,
  conversationId = null,
  sessionEntries = [],
  selectedLogId = null,
  onSelectLog,
}) {
  const [serverRuns, setServerRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError("");
    try {
      const runs = await listAgentToolRuns(agentId, { take: 40 });
      setServerRuns(Array.isArray(runs) ? runs : []);
    } catch (err) {
      setError(err.message || "Unable to load tool runs");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    refresh();
  }, [refresh, conversationId]);

  const filteredServer = useMemo(() => {
    if (!conversationId) return serverRuns;
    const scoped = serverRuns.filter(
      (r) => r.conversationId === conversationId
    );
    return scoped.length ? scoped : serverRuns;
  }, [serverRuns, conversationId]);

  function pickSession(entry, issue) {
    onSelectLog?.({
      id: entry.id,
      source: "session",
      entry,
      issue,
    });
  }

  function pickServer(run, issue) {
    const entry = {
      kind: "tool",
      id: run.id,
      name: run.actionName || "unknown",
      actionName: run.actionName,
      status: run.status,
      httpStatus: run.httpStatus,
      durationMs: run.durationMs,
      errorCode: run.errorCode,
      errorCategory: run.errorCategory,
      requestId: run.requestId,
      conversationId: run.conversationId,
      actionId: run.actionId,
      actionVersion: run.actionVersion,
      customerSubject: run.customerSubject,
      at: run.createdAt,
      createdAt: run.createdAt,
    };
    onSelectLog?.({
      id: run.id,
      source: "server",
      entry,
      issue,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-foreground">Developer logs</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Click a row for full details. Panels stay equal width and resize
            smoothly when a log opens.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Refresh
        </Button>
      </div>

      <ScrollArea className="mt-3 min-h-0 flex-1">
        <div className="flex flex-col gap-4 pr-3">
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ScrollText className="size-3.5" />
              This chat session
            </p>
            {sessionEntries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                Send a message in the emulator. Tool calls, retrieval, and chat
                errors will appear here.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...sessionEntries].reverse().map((entry) => (
                  <SessionRow
                    key={entry.id}
                    entry={entry}
                    selected={selectedLogId === entry.id}
                    onSelect={onSelectLog ? pickSession : undefined}
                  />
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Server tool runs
              {conversationId ? " (this conversation first)" : ""}
            </p>
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
            {loading && filteredServer.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                <Spinner /> Loading…
              </div>
            ) : filteredServer.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                No durable ToolRun rows yet. Failed policy gates may only show
                in the session list above.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {filteredServer.map((run) => (
                  <SessionRow
                    key={run.id}
                    entry={{
                      kind: "tool",
                      name: run.actionName || "unknown",
                      status: run.status,
                      httpStatus: run.httpStatus,
                      durationMs: run.durationMs,
                      errorCode: run.errorCode,
                      requestId: run.requestId,
                      at: run.createdAt,
                    }}
                    selected={selectedLogId === run.id}
                    onSelect={
                      onSelectLog
                        ? (_entry, issue) => pickServer(run, issue)
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Build chronological session log entries from assistant messages + chat errors.
 */
export function buildSessionLogEntries(messages = [], extra = []) {
  const entries = [];
  for (const m of messages || []) {
    if (m.role !== "ASSISTANT" || m.local) continue;
    const at = m.createdAt || null;
    const used = m.usedKnowledge || [];
    if (used.length || m.toolSteps?.length) {
      entries.push({
        id: `kb-${m.id}`,
        kind: "knowledge",
        at,
        count: used.length,
        titles: used.map((k) => k.title || k.name || k.id).filter(Boolean),
        status: used.length ? "OK" : "EMPTY",
      });
    }
    for (const step of m.toolSteps || []) {
      entries.push({
        id: `tool-${m.id}-${step.name}-${step.errorCode || step.status}`,
        kind: "tool",
        name: step.name,
        status: step.status,
        httpStatus: step.httpStatus,
        durationMs: step.durationMs,
        errorCode: step.errorCode,
        requestId: step.requestId || null,
        at,
      });
    }
    if (m.degraded) {
      entries.push({
        id: `deg-${m.id}`,
        kind: "chat",
        status: "DEGRADED",
        degraded: true,
        at,
      });
    }
  }
  return [...entries, ...(extra || [])];
}
