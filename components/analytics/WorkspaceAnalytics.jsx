"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  AgentCountCard,
  AnalyticsError,
  AnalyticsKpiGrid,
  embedSiteHost,
  formatPercent,
  formatResponseTime,
  formatTopic,
  useAnalyticsDashboard,
} from "@/components/analytics/analytics-shared";
import { ChartCard, InsightsList } from "@/components/analytics/AnalyticsCharts";
import {
  ActivityHeatmap,
  AgentRadarChart,
  ChartAreaInteractive,
  ResponseHistogram,
  StackedSentimentChart,
  TopicMixChart,
  WorkloadChart,
} from "@/components/analytics/WorkspaceCharts";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUrlTab } from "@/hooks/use-url-tab";

function ChartSkeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-[var(--color-bg)]", className)} />;
}

const RANGES = ["7d", "30d"];

export function WorkspaceAnalytics({
  loader,
  agentHref,
  hideManageAgents = false,
}) {
  const [range, setRange] = useUrlTab("range", RANGES, "7d");
  const { data, loading, error } = useAnalyticsDashboard({ range, loader });
  const overview = data?.overview;
  const agents = data?.agents || [];

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--color-muted)]">
        Combined insight across every agent in this workspace.
      </p>

      <AnalyticsError error={error} />

      <AnalyticsKpiGrid
        overview={overview}
        loading={loading}
        extra={
          <AgentCountCard
            agentCount={data?.agentCount}
            activeAgents={data?.activeAgents}
            loading={loading}
          />
        }
      />

      <ChartAreaInteractive
        points={data?.trends?.points || []}
        range={range}
        onRangeChange={setRange}
        loading={loading}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="When customers reach out"
          description="Weekday by hour. Darker cells are busier — hover for the exact hour."
          className="lg:col-span-3"
        >
          {loading ? (
            <ChartSkeleton className="h-[188px] w-full" />
          ) : (
            <ActivityHeatmap heatmap={data?.heatmap} />
          )}
        </ChartCard>
        <ChartCard
          title="Topics"
          description="Share of chats by category, with count bars."
          className="lg:col-span-2"
        >
          {loading ? (
            <ChartSkeleton className="h-[188px] w-full" />
          ) : (
            <TopicMixChart topics={data?.topics?.distribution || []} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Sentiment over time" description="Separate lines for positive, neutral, negative.">
          {loading ? (
            <ChartSkeleton className="h-[220px] w-full" />
          ) : (
            <StackedSentimentChart points={data?.sentimentTrend || []} />
          )}
        </ChartCard>
        <ChartCard title="Reply latency" description="How many replies landed in each speed bucket.">
          {loading ? (
            <ChartSkeleton className="h-[220px] w-full" />
          ) : (
            <ResponseHistogram buckets={data?.responseBuckets || []} />
          )}
        </ChartCard>
        <ChartCard
          title="Workload by agent"
          description="One colored line per agent. Switch chats, messages, or positive chats."
          className="lg:col-span-2"
        >
          {loading ? (
            <ChartSkeleton className="h-[280px] w-full" />
          ) : (
            <WorkloadChart workload={data?.workloadTrend} />
          )}
        </ChartCard>
        <ChartCard
          title="Agent health"
          description="Hexagon profile: volume, positivity, speed, depth, share, and activity."
        >
          {loading ? (
            <ChartSkeleton className="mx-auto aspect-square max-h-[280px] w-full" />
          ) : (
            <AgentRadarChart agents={agents} />
          )}
        </ChartCard>
        <ChartCard title="Insights worth acting on">
          {loading ? (
            <ChartSkeleton className="h-[220px] w-full" />
          ) : (
            <InsightsList insights={data?.insights || []} />
          )}
        </ChartCard>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-1 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Per-agent breakdown
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
              Same window as the charts. Website is where the widget is live.
            </p>
          </div>
          {!hideManageAgents ? (
            <Link
              href="/agents"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Manage agents
            </Link>
          ) : null}
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-[var(--color-muted)]">
            Loading agent stats…
          </p>
        ) : agents.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--color-muted)]">
            {hideManageAgents ? (
              "No agents in this workspace yet."
            ) : (
              <>
                No agents yet.{" "}
                <Link
                  href="/agents/new"
                  className="font-medium text-[var(--color-primary)] underline"
                >
                  Create an agent
                </Link>{" "}
                to start collecting analytics.
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="px-5 py-2.5 font-medium">Agent</th>
                  <th className="px-3 py-2.5 font-medium">Website</th>
                  <th className="px-3 py-2.5 font-medium">Chats</th>
                  <th className="px-3 py-2.5 font-medium">Share</th>
                  <th className="px-3 py-2.5 font-medium">Messages</th>
                  <th className="px-3 py-2.5 font-medium">Avg reply</th>
                  <th className="px-3 py-2.5 font-medium">Positive</th>
                  <th className="px-3 py-2.5 font-medium">Top topic</th>
                  <th className="px-5 py-2.5 font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-5 py-3 font-medium text-[var(--color-text)]">
                      {agent.name}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">
                      {agent.siteKnowledgeOrigin ? (
                        <a
                          href={agent.siteKnowledgeOrigin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {embedSiteHost(agent.siteKnowledgeOrigin)}
                        </a>
                      ) : (
                        <span className="text-[var(--color-muted)]">Not embedded</span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text)]">
                      {agent.conversations}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text-secondary)]">
                      {agent.percent}%
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text)]">
                      {agent.messages}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text-secondary)]">
                      {formatResponseTime(agent.averageResponseTimeMs)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--color-text-secondary)]">
                      {agent.conversations
                        ? formatPercent(agent.positiveSentimentPercent)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--color-text-secondary)]">
                      {formatTopic(agent.mostCommonTopic)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {agentHref ? (
                        <Link
                          href={agentHref(agent.id)}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          Inspect agent
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </Link>
                      ) : (
                        <Link
                          href={`/agents/${agent.id}/analytics`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                        >
                          Agent analytics
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
