"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AnalyticsError,
  AnalyticsKpiGrid,
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

export function AnalyticsBoard({ agentId }) {
  const [range, setRange] = useState("7d");
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
