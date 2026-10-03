"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gauge } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/analytics/AnalyticsCharts";
import { AnalyticsError } from "@/components/analytics/analytics-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { getQa } from "@/lib/api/analytics";
import { queryKeys } from "@/lib/query/keys";

/** Level 3 · L2 — CX score trend + ungrounded / risky answers. */
export function QaPanel({ agentId, range }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.qa({ agentId, range }),
    queryFn: () => getQa({ agentId, range }),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
  const data = query.data;
  const loading = query.isPending;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="qa-heading">
      <div className="flex flex-col gap-0.5">
        <h2 id="qa-heading" className="text-sm font-semibold text-foreground">
          Answer quality
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Sampled settled chats (workspace QA settings). Scores come from a judge JSON only — never
          from instructions inside the transcript.
        </p>
      </div>

      <AnalyticsError error={query.error?.message || ""} onRetry={query.refetch} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          compact
          label="Average CX score"
          value={data?.averageCxScore == null ? "—" : String(data.averageCxScore)}
          hint={data ? `${data.scoredCount} scored chats` : ""}
          loading={loading}
          tone="info"
          icon={Gauge}
        />
        <MetricCard
          compact
          label="Risky answers"
          value={loading ? "" : String(data?.riskyAnswers?.length ?? 0)}
          hint="Ungrounded AI claims"
          loading={loading}
          tone="warning"
          icon={AlertTriangle}
        />
      </div>

      <ChartCard title="Risky answers" description="Ungrounded AI claims from Auto-QA.">
        {loading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : data?.riskyAnswers?.length ? (
          <ul className="divide-y divide-border">
            {data.riskyAnswers.slice(0, 12).map((row, index) => (
              <li key={`${row.conversationId}-${index}`} className="flex flex-col gap-1 py-2.5 text-sm">
                <p className="text-foreground">{row.claim || "Ungrounded claim"}</p>
                <Link
                  href={`/inbox/${row.conversationId}`}
                  className="text-xs text-primary hover:underline"
                >
                  Open conversation
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No risky answers in this range.
          </p>
        )}
      </ChartCard>
    </section>
  );
}
