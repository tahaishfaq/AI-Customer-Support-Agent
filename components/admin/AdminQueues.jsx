"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { getAdminQueueCounts } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function CountCell({ label, value, warn = false }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-mono text-lg font-semibold tabular-nums",
          warn && Number(value) > 0 ? "text-destructive" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function AdminQueues() {
  const query = useQuery({
    queryKey: queryKeys.admin.queues,
    queryFn: getAdminQueueCounts,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const enabled = query.data?.enabled === true;
  const queues = Array.isArray(query.data?.queues) ? query.data.queues : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <PageHeader
        title="Queues"
        description="BullMQ depth counts only — no job payloads or secrets."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={cn("size-3.5", query.isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={enabled ? "default" : "secondary"}>
          BullMQ {enabled ? "enabled" : "disabled"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Ops: pause / drain / retry → docs/features/BULLMQ_OPS_RUNBOOK.md
        </span>
      </div>

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : null}

      {query.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {query.error.message || "Unable to load queue counts"}
        </p>
      ) : null}

      {!query.isLoading && !query.error ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {queues.map((q) => (
            <section
              key={q.name}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-mono text-sm font-semibold text-foreground">
                  {q.name}
                </h2>
                {q.error || q.unavailable ? (
                  <Badge variant="destructive">unavailable</Badge>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <CountCell label="Waiting" value={q.waiting ?? 0} />
                <CountCell label="Active" value={q.active ?? 0} />
                <CountCell label="Delayed" value={q.delayed ?? 0} />
                <CountCell label="Completed" value={q.completed ?? 0} />
                <CountCell label="Failed" value={q.failed ?? 0} warn />
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
