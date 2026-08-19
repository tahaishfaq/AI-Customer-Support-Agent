"use client";

import Link from "next/link";
import {
  AnalyticsError,
  AnalyticsKpiGrid,
  embedSiteHost,
  RangeChips,
  useAnalyticsDashboard,
} from "@/components/analytics/analytics-shared";
import { ChartCard, InsightsList } from "@/components/analytics/AnalyticsCharts";
import {
  SentimentOverTimeChart,
  SentimentShareChart,
  TopicMixChart,
  VolumeTrendChart,
} from "@/components/analytics/WorkspaceCharts";
import { useUrlTab } from "@/hooks/use-url-tab";

const RANGES = ["7d", "30d"];

export function AnalyticsBoard({ agentId }) {
  const [range, setRange] = useUrlTab("range", RANGES, "7d");
  const { data, loading, error } = useAnalyticsDashboard({ agentId, range });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RangeChips range={range} onChange={setRange} />
        <p className="text-[12px] text-[var(--color-muted)]">
          This agent only.{" "}
          <Link href="/analytics" className="font-medium text-[var(--color-primary)] hover:underline">
            Workspace analytics
          </Link>{" "}
          show all agents together.
        </p>
      </div>

      <AnalyticsError error={error} />

      <AnalyticsKpiGrid overview={data?.overview} loading={loading} />

      {!loading && data?.agents?.[0] ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Live website
          </p>
          {data.agents[0].siteKnowledgeOrigin ? (
            <a
              href={data.agents[0].siteKnowledgeOrigin}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              {embedSiteHost(data.agents[0].siteKnowledgeOrigin)}
            </a>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              This agent is not embedded on a public site yet.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Conversation trend"
          description="Teal is chats, blue is messages. Switch Bars or Lines."
          className="lg:col-span-2"
        >
          {loading ? (
            <div className="h-[240px] w-full animate-pulse rounded-lg bg-[var(--color-bg)]" />
          ) : (
            <VolumeTrendChart points={data?.trends?.points || []} />
          )}
        </ChartCard>
        <ChartCard title="Topics" description="Share of chats by category.">
          {loading ? (
            <div className="h-[220px] animate-pulse rounded-lg bg-[var(--color-bg)]" />
          ) : (
            <TopicMixChart topics={data?.topics?.distribution || []} />
          )}
        </ChartCard>
        <ChartCard title="Sentiment" description="Share of chats that felt positive, neutral, or negative.">
          {loading ? (
            <div className="h-[220px] animate-pulse rounded-lg bg-[var(--color-bg)]" />
          ) : (
            <SentimentShareChart sentiment={data?.sentiment?.distribution || []} />
          )}
        </ChartCard>
        <ChartCard
          title="Sentiment over time"
          description="Switch lines vs stacked bars to compare mix vs volume."
          className="lg:col-span-2"
        >
          {loading ? (
            <div className="h-[220px] animate-pulse rounded-lg bg-[var(--color-bg)]" />
          ) : (
            <SentimentOverTimeChart points={data?.sentimentTrend || []} />
          )}
        </ChartCard>
        <ChartCard title="Business insights" className="lg:col-span-2">
          {loading ? (
            <div className="h-48 animate-pulse rounded-lg bg-[var(--color-bg)]" />
          ) : (
            <InsightsList insights={data?.insights || []} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
