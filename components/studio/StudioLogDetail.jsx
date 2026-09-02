"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function toneFor(entry) {
  const s = String(entry?.status || "").toUpperCase();
  if (s === "OK" || s === "SUCCESS") return "ok";
  if (entry?.errorCode || s === "ERROR" || s === "TIMEOUT") return "err";
  if (s === "PENDING" || s === "CONFIRMATION_REQUIRED" || s === "DEGRADED") {
    return "warn";
  }
  return "muted";
}

function DetailRow({ label, value, mono = false }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm text-foreground",
          mono && "break-all font-mono text-xs"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function StudioLogDetail({ entry, source = "session", onClose }) {
  if (!entry) return null;

  const tone = toneFor(entry);
  const title =
    entry.kind === "knowledge"
      ? "Knowledge retrieval"
      : entry.kind === "chat_error"
        ? "Chat error"
        : entry.kind === "chat"
          ? "Chat turn"
          : entry.name || entry.actionName || "Tool run";

  return (
    <Card className="flex h-full flex-col overflow-hidden shadow-none">
      <CardHeader className="shrink-0 border-b pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{title}</CardTitle>
            <CardDescription className="mt-1">
              {source === "server" ? "Server tool run" : "This chat session"}
              {entry.at || entry.createdAt
                ? ` · ${new Date(entry.at || entry.createdAt).toLocaleString()}`
                : ""}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close log detail"
          >
            <X />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {entry.status ? (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full",
                tone === "ok" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                tone === "err" && "border-destructive/40 text-destructive",
                tone === "warn" && "border-amber-500/40 text-amber-700 dark:text-amber-400"
              )}
            >
              {entry.status}
            </Badge>
          ) : null}
          {entry.httpStatus != null ? (
            <Badge variant="secondary" className="rounded-full">
              HTTP {entry.httpStatus}
            </Badge>
          ) : null}
          {entry.errorCode ? (
            <Badge variant="destructive" className="rounded-full">
              {entry.errorCode}
            </Badge>
          ) : null}
          {entry.durationMs != null ? (
            <span className="text-xs text-muted-foreground">
              {entry.durationMs}ms
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto pt-4">
        <dl className="flex flex-col gap-4">
          <DetailRow label="Kind" value={entry.kind || "tool"} />
          <DetailRow
            label="Tool / action"
            value={entry.name || entry.actionName}
          />
          <DetailRow label="Request ID" value={entry.requestId} mono />
          <DetailRow label="Run ID" value={entry.id} mono />
          <DetailRow label="Conversation" value={entry.conversationId} mono />
          <DetailRow label="Action ID" value={entry.actionId} mono />
          <DetailRow
            label="Action version"
            value={
              entry.actionVersion != null ? String(entry.actionVersion) : null
            }
          />
          <DetailRow label="Customer subject" value={entry.customerSubject} />
          <DetailRow label="Error category" value={entry.errorCategory} />
          {entry.kind === "knowledge" ? (
            <>
              <DetailRow
                label="Chunks retrieved"
                value={entry.count != null ? String(entry.count) : null}
              />
              {(entry.titles || []).length ? (
                <div className="flex flex-col gap-1.5">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Sources
                  </dt>
                  <dd className="flex flex-col gap-1">
                    {(entry.titles || []).map((t) => (
                      <span
                        key={t}
                        className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
          {entry.message ? (
            <DetailRow label="Message" value={entry.message} />
          ) : null}
        </dl>

        {entry.issue ? (
          <div className="mt-5 rounded-xl border border-border bg-muted/30 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              What happened
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">
              {entry.issue}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
