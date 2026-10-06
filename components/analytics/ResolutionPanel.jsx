"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, HelpCircle, Star, Timer, UserRound } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChartCard } from "@/components/analytics/AnalyticsCharts";
import { AnalyticsError } from "@/components/analytics/analytics-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { getResolution } from "@/lib/api/analytics";
import { queryKeys } from "@/lib/query/keys";

const percent = (value) => (value == null ? "—" : `${value}%`);

function formatFirstReply(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  return `${Math.round(ms / 60_000)} m`;
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

/** Level 2 · M2 — how many customer conversations the AI resolved, and what it could not answer. */
export function ResolutionPanel({ agentId, range }) {
  const query = useQuery({
    queryKey: queryKeys.analytics.resolution({ agentId, range }),
    queryFn: () => getResolution({ agentId, range }),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
  const data = query.data;
  const loading = query.isPending;
  const since = formatDate(data?.trackingSince);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="resolution-heading">
      <div className="flex flex-col gap-0.5">
        <h2 id="resolution-heading" className="text-sm font-semibold text-foreground">
          Resolution
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Website chats with a customer question. A chat counts once it has been quiet for 24 hours.
          {since ? ` Tracked since ${since}.` : " Tracking starts with the next AI reply."}
        </p>
      </div>

      <AnalyticsError error={query.error?.message || ""} onRetry={query.refetch} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          compact
          label="Resolved by AI"
          value={percent(data?.automationRate)}
          hint={data ? `${data.aiResolved} of ${data.tracked} settled chats` : ""}
          loading={loading}
          tone="positive"
          icon={CircleCheck}
        />
        <MetricCard
          compact
          label="Handed to a human"
          value={percent(data?.handoffRate)}
          hint={data ? `${data.handedOff} of ${data.conversations} chats` : ""}
          loading={loading}
          tone="warning"
          icon={UserRound}
        />
        <MetricCard
          compact
          label="Solved by your team"
          value={loading ? "" : String(data?.humanResolved ?? 0)}
          hint="After a handoff"
          loading={loading}
          tone="info"
          icon={UserRound}
        />
        <MetricCard
          compact
          label="Median first reply"
          value={formatFirstReply(data?.medianFirstResponseMs)}
          hint="First AI reply time"
          loading={loading}
          icon={Timer}
        />
        <MetricCard
          compact
          label="Customer rating"
          value={data?.csatAverage == null ? "—" : `${data.csatAverage} / 5`}
          hint={data?.csatCount ? `${data.csatCount} rating${data.csatCount === 1 ? "" : "s"}` : "No ratings yet"}
          loading={loading}
          icon={Star}
        />
      </div>

      <ChartCard
        title="Unanswered questions"
        description="Questions the AI could not answer from your knowledge or tools. Add the answer to your knowledge to fix them."
      >
        {loading ? (
          <Skeleton className="h-32 w-full rounded-lg" />
        ) : data?.unanswered?.length ? (
          <ul className="divide-y divide-border">
            {data.unanswered.map((item) => (
              <li key={`${item.question}-${item.conversationId}`} className="flex items-start justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2">
                  <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="min-w-0 break-words text-sm text-foreground">{item.question}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">{item.count}×</span>
                  {item.agentId && item.conversationId ? (
                    <Link
                      href={`/agents/${item.agentId}/conversations/${item.conversationId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      Open chat
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No unanswered questions in this range.
          </p>
        )}
      </ChartCard>
    </section>
  );
}
