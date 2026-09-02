"use client";

import Link from "next/link";
import {
  AnalyticsError,
  AnalyticsKpiGrid,
  ANALYTICS_RANGE_IDS,
  embedSiteHost,
  RangeChips,
  useAnalyticsDashboard,
} from "@/components/analytics/analytics-shared";
import { AnalyticsExportMenu } from "@/components/analytics/AnalyticsExportMenu";
import { ChartCard, InsightsList } from "@/components/analytics/AnalyticsCharts";
import {
  SentimentOverTimeChart,
  SentimentShareChart,
  TopicMixChart,
  VolumeTrendChart,
} from "@/components/analytics/lazy-charts";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUrlTab } from "@/hooks/use-url-tab";

export function AnalyticsBoard({ agentId }) {
  const [range, setRange] = useUrlTab("range", ANALYTICS_RANGE_IDS, "7d");
  const { data, loading, error, reload } = useAnalyticsDashboard({
    agentId,
    range,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Range
            </span>
            <RangeChips range={range} onChange={setRange} variant="select" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Range applies to every KPI and chart on this page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AnalyticsExportMenu
            data={data}
            range={range}
            scope="agent"
            disabled={loading}
          />
          <p className="hidden text-xs text-muted-foreground sm:block">
            This agent only.{" "}
            <Link
              href="/analytics"
              className="font-medium text-primary hover:underline"
            >
              Workspace analytics
            </Link>{" "}
            show all agents together.
          </p>
          <p className="text-xs text-muted-foreground sm:hidden">
            <Link href="/analytics" className="font-medium text-primary hover:underline">
              Workspace analytics
            </Link>
          </p>
        </div>
      </div>

      <AnalyticsError error={error} onRetry={reload} />

      <AnalyticsKpiGrid overview={data?.overview} loading={loading} />

      {!loading && data?.agents?.[0] ? (
        <Card className="shadow-none">
          <CardHeader className="py-3.5">
            <CardDescription className="text-[11px] font-medium tracking-wide uppercase">
              Live website
            </CardDescription>
            {data.agents[0].siteKnowledgeOrigin ? (
              <CardTitle className="text-sm font-medium">
                <a
                  href={data.agents[0].siteKnowledgeOrigin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {embedSiteHost(data.agents[0].siteKnowledgeOrigin)}
                </a>
              </CardTitle>
            ) : (
              <CardTitle className="text-sm font-normal text-muted-foreground">
                This agent is not embedded on a public site yet.
              </CardTitle>
            )}
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Conversation trend"
          description="Teal is chats, blue is messages. Switch Bars or Lines."
          className="lg:col-span-2"
        >
          {loading ? (
            <Skeleton className="h-[240px] w-full rounded-lg" />
          ) : (
            <VolumeTrendChart points={data?.trends?.points || []} />
          )}
        </ChartCard>
        <ChartCard title="Topics" description="Share of chats by category.">
          {loading ? (
            <Skeleton className="h-[220px] rounded-lg" />
          ) : (
            <TopicMixChart topics={data?.topics?.distribution || []} />
          )}
        </ChartCard>
        <ChartCard
          title="Sentiment"
          description="Share of chats that felt positive, neutral, or negative."
        >
          {loading ? (
            <Skeleton className="h-[220px] rounded-lg" />
          ) : (
            <SentimentShareChart
              sentiment={data?.sentiment?.distribution || []}
            />
          )}
        </ChartCard>
        <ChartCard
          title="Sentiment over time"
          description="Switch lines vs stacked bars to compare mix vs volume."
          className="lg:col-span-2"
        >
          {loading ? (
            <Skeleton className="h-[220px] rounded-lg" />
          ) : (
            <SentimentOverTimeChart points={data?.sentimentTrend || []} />
          )}
        </ChartCard>
        <ChartCard title="Business insights" className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-48 rounded-lg" />
          ) : (
            <InsightsList insights={data?.insights || []} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
