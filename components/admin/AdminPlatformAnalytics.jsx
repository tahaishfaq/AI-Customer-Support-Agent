"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAdminOverview, getAdminPlatformDashboard } from "@/lib/api/admin";
import {
  AnalyticsError,
  embedSiteHost,
  formatPercent,
  formatResponseTime,
  formatTopic,
  RangeChips,
  useAnalyticsDashboard,
  ANALYTICS_RANGE_IDS,
} from "@/components/analytics/analytics-shared";
import { AnalyticsExportMenu } from "@/components/analytics/AnalyticsExportMenu";
import {
  ChartCard,
  ChartEmpty,
  InsightsList,
} from "@/components/analytics/AnalyticsCharts";
import {
  ActivityHeatmap,
  ChartSkeleton,
  PlatformGrowthChart,
  PlatformVolumeChart,
  StackedSentimentChart,
} from "@/components/analytics/lazy-charts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUrlTab } from "@/hooks/use-url-tab";

const AGENT_PAGE_SIZE = 6;

const TOPIC_COLORS = {
  SUPPORT: "var(--chart-1)",
  SALES: "var(--chart-2)",
  PRICING: "var(--chart-3)",
  TECHNICAL: "var(--chart-4)",
  GENERAL: "var(--chart-5)",
};

const SENTIMENT_COLORS = {
  POSITIVE: "var(--color-success)",
  NEUTRAL: "var(--muted-foreground)",
  NEGATIVE: "var(--destructive)",
};

const LATENCY_COLORS = {
  fast: "var(--color-success)",
  ok: "var(--chart-1)",
  avg: "var(--chart-3)",
  slow: "var(--chart-4)",
  heavy: "var(--destructive)",
};

function Stat({ label, value, warn, href }) {
  const inner = (
    <>
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-[15px] font-semibold tabular-nums leading-tight text-foreground",
          warn && "text-destructive",
          href && "group-hover:text-primary"
        )}
      >
        {value}
      </p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group min-w-0 px-2 py-1.5 outline-none transition-colors focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-2.5 sm:py-2"
      >
        {inner}
      </Link>
    );
  }
  return <div className="min-w-0 px-2 py-1.5 sm:px-2.5 sm:py-2">{inner}</div>;
}

function Composition({ rows, empty }) {
  const total = rows.reduce((sum, row) => sum + (row.count || 0), 0);
  if (!total) {
    return <ChartEmpty message={empty} className="min-h-[120px] h-auto" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-2.5 shrink-0 overflow-hidden rounded-full bg-muted/60">
        {rows
          .filter((row) => row.count > 0)
          .map((row) => (
            <div
              key={row.key}
              title={`${row.label}: ${row.count} (${row.percent}%)`}
              style={{
                width: `${Math.max(row.percent, 0.5)}%`,
                background: row.color,
              }}
            />
          ))}
      </div>
      <ul className="mt-2.5 flex min-h-0 flex-1 flex-col justify-evenly gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-[11px] leading-none">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: row.color }}
            />
            <span className="w-[4.25rem] shrink-0 truncate text-muted-foreground">
              {row.label}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{
                  width: `${row.percent || 0}%`,
                  background: row.color,
                  opacity: row.count ? 1 : 0.25,
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right tabular-nums text-foreground">
              {row.count}
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
              {row.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LatencyBars({ buckets }) {
  const total = buckets.reduce((sum, row) => sum + (row.count || 0), 0);
  if (!total) {
    return <ChartEmpty message="No timed replies." className="min-h-[120px] h-auto" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-2.5 shrink-0 overflow-hidden rounded-full bg-muted/60">
        {buckets
          .filter((row) => row.count > 0)
          .map((row) => (
            <div
              key={row.id || row.label}
              title={`${row.label}: ${row.count}`}
              style={{
                width: `${(row.count / total) * 100}%`,
                background: LATENCY_COLORS[row.id] || "var(--chart-5)",
              }}
            />
          ))}
      </div>
      <ul className="mt-2.5 flex min-h-0 flex-1 flex-col justify-evenly gap-1">
        {buckets.map((row) => {
          const pct = Number(((row.count / total) * 100).toFixed(1));
          return (
            <li
              key={row.id || row.label}
              className="flex items-center gap-2 text-[11px] leading-none"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: LATENCY_COLORS[row.id] || "var(--chart-5)" }}
              />
              <span className="w-12 shrink-0 text-muted-foreground">
                {row.label}
              </span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{
                    width: `${pct}%`,
                    background: LATENCY_COLORS[row.id] || "var(--chart-5)",
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-foreground">
                {row.count}
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SentimentSplit({ positive, negative }) {
  const pos = Number(positive) || 0;
  const neg = Number(negative) || 0;
  const rest = Math.max(0, 100 - pos - neg);
  return (
    <div className="flex h-1.5 w-[72px] overflow-hidden rounded-full bg-muted/60">
      <div className="h-full bg-[var(--color-success)]" style={{ width: `${pos}%` }} />
      <div className="h-full bg-muted-foreground/30" style={{ width: `${rest}%` }} />
      <div className="h-full bg-destructive" style={{ width: `${neg}%` }} />
    </div>
  );
}

export function AdminPlatformAnalytics() {
  const [range, setRange] = useUrlTab("range", ANALYTICS_RANGE_IDS, "7d");
  const [chartsEnabled, setChartsEnabled] = useState(false);
  const [shell, setShell] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAdminOverview()
      .then((overview) => {
        if (!cancelled) setShell(overview);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setChartsEnabled(false);
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setChartsEnabled(true);
    };
    let idleId;
    let timeoutId;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(enable, { timeout: 400 });
    } else {
      timeoutId = window.setTimeout(enable, 50);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [range]);

  const loader = useCallback(
    ({ range: nextRange } = {}) => getAdminPlatformDashboard({ range: nextRange }),
    []
  );
  const { data, loading, error, reload } = useAnalyticsDashboard({
    range,
    loader,
    enabled: chartsEnabled,
    keepPrevious: true,
  });
  const overview = data?.overview;
  const platform = data?.platform;
  const agents = data?.agents || [];
  const chartsLoading = !chartsEnabled || loading;
  const shellUsers = platform?.users ?? shell?.users;
  const shellSpaces = platform?.workspaces ?? shell?.workspaces;
  const shellAgents = platform?.agents ?? shell?.agents;
  const shellChatsTotal = platform?.conversationsTotal ?? shell?.conversationsTotal;
  const pendingRestores = shell?.pendingRestoreCount ?? 0;
  const suspendedUsers = shell?.suspendedUsers ?? 0;
  const [agentPage, setAgentPage] = useState(1);
  const agentPages = Math.max(1, Math.ceil(agents.length / AGENT_PAGE_SIZE));
  const safeAgentPage = Math.min(agentPage, agentPages);
  const pagedAgents = agents.slice(
    (safeAgentPage - 1) * AGENT_PAGE_SIZE,
    safeAgentPage * AGENT_PAGE_SIZE
  );
  const maxChats = Math.max(...agents.map((agent) => agent.conversations || 0), 1);

  useEffect(() => {
    setAgentPage(1);
  }, [range, agents.length]);
  const liveSites = agents.filter((agent) => agent.siteKnowledgeOrigin);
  const embedRate =
    platform?.agents > 0
      ? Math.round((platform.liveEmbeds / platform.agents) * 1000) / 10
      : 0;
  const activeAgents = agents.filter((a) => a.conversations > 0).length;
  const buckets = data?.responseBuckets || [];

  const topicRows = ["SUPPORT", "SALES", "PRICING", "TECHNICAL", "GENERAL"].map(
    (key) => {
      const item = (data?.topics?.distribution || []).find(
        (row) => row.category === key
      );
      return {
        key,
        label: item?.label || key.charAt(0) + key.slice(1).toLowerCase(),
        count: item?.count || 0,
        percent: item?.percent || 0,
        color: TOPIC_COLORS[key],
      };
    }
  );

  const sentimentRows = [
    { key: "POSITIVE", label: "Positive", color: SENTIMENT_COLORS.POSITIVE },
    { key: "NEUTRAL", label: "Neutral", color: SENTIMENT_COLORS.NEUTRAL },
    { key: "NEGATIVE", label: "Negative", color: SENTIMENT_COLORS.NEGATIVE },
  ].map((slot) => {
    const item = (data?.sentiment?.distribution || []).find(
      (row) => row.sentiment === slot.key
    );
    return {
      ...slot,
      count: item?.count || 0,
      percent: item?.percent || 0,
    };
  });

  return (
    <main className="aide-page !px-4 !py-3 lg:!px-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            All tenants · range applied to chats, growth, and agent volume
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeChips range={range} onChange={setRange} className="max-w-full" />
          <AnalyticsExportMenu
            data={data}
            range={range}
            scope="platform"
            disabled={chartsLoading}
            includeGrowth
          />
        </div>
      </header>

      <AnalyticsError error={error} onRetry={reload} />

      <section className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12 [&>a]:min-w-0 [&>a]:border-b [&>a]:border-r [&>a]:border-border/60 [&>div]:min-w-0 [&>div]:border-b [&>div]:border-r [&>div]:border-border/60">
        <Stat
          label="Users"
          value={shellUsers == null ? "—" : shellUsers}
          href="/admin/users"
        />
        <Stat
          label="Suspended"
          value={shell == null ? "—" : suspendedUsers}
          href="/admin/users?status=SUSPENDED"
          warn={suspendedUsers > 0}
        />
        <Stat
          label="Requests"
          value={shell == null ? "—" : pendingRestores}
          href="/admin/requests"
          warn={pendingRestores > 0}
        />
        <Stat
          label="Spaces"
          value={shellSpaces == null ? "—" : shellSpaces}
        />
        <Stat
          label="Agents"
          value={shellAgents == null ? "—" : shellAgents}
        />
        <Stat label="Live sites" value={chartsLoading && !platform ? "—" : platform?.liveEmbeds ?? 0} />
        <Stat label="Embed %" value={chartsLoading && !platform ? "—" : `${embedRate}%`} />
        <Stat
          label="Active agents"
          value={
            chartsLoading && !data
              ? "—"
              : `${activeAgents}/${platform?.agents ?? shellAgents ?? 0}`
          }
        />
        <Stat
          label="Chats"
          value={
            chartsLoading && !overview
              ? shellChatsTotal == null
                ? "—"
                : shellChatsTotal
              : overview?.totalConversations ?? 0
          }
        />
        <Stat label="Messages" value={chartsLoading && !overview ? "—" : overview?.totalMessages ?? 0} />
        <Stat
          label="Positive"
          value={chartsLoading && !overview ? "—" : formatPercent(overview?.positiveSentimentPercent)}
        />
        <Stat
          label="Negative"
          value={chartsLoading && !overview ? "—" : formatPercent(overview?.negativeSentimentPercent)}
          warn={(overview?.negativeSentimentPercent || 0) >= 25}
        />
      </section>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Growth KPIs (users / spaces / agents / chats) · Quality KPIs (positive / negative sentiment)
      </p>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
        <ChartCard
          dense
          title="Growth"
          description="New users, agents, sites, and chats over the range."
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[168px] w-full" />
          ) : (
            <PlatformGrowthChart
              points={data?.growth?.points || []}
              className="h-[168px]"
            />
          )}
        </ChartCard>
        <ChartCard
          dense
          title="Chat volume"
          description="Platform chats and messages by day."
          aside={`${overview?.totalConversations ?? 0} chats`}
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[168px] w-full" />
          ) : (
            <PlatformVolumeChart points={data?.trends?.points || []} />
          )}
        </ChartCard>
      </div>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-3">
        <ChartCard
          dense
          title="Reach hours"
          description="When customers message across tenants."
          aside={data?.heatmap?.peak?.label || "—"}
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[148px] w-full" />
          ) : (
            <ActivityHeatmap heatmap={data?.heatmap} compact />
          )}
        </ChartCard>
        <ChartCard
          dense
          title="Topics"
          description="Share of chats by category."
          aside={`${overview?.totalConversations ?? 0} chats`}
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[120px] w-full" />
          ) : (
            <Composition rows={topicRows} empty="No categorized chats yet." />
          )}
        </ChartCard>
        <ChartCard dense title="Sentiment mix" description="Positive, neutral, and negative share.">
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[120px] w-full" />
          ) : (
            <Composition rows={sentimentRows} empty="No labeled sentiment yet." />
          )}
        </ChartCard>
      </div>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-3">
        <ChartCard
          dense
          title="Sentiment trend"
          description="How mood shifted over the range."
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[168px] w-full" />
          ) : (
            <StackedSentimentChart
              points={data?.sentimentTrend || []}
              className="h-full min-h-[160px] flex-1"
            />
          )}
        </ChartCard>
        <ChartCard
          dense
          title="Latency buckets"
          description="How fast replies landed."
          aside={formatResponseTime(overview?.averageResponseTimeMs)}
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[120px] w-full" />
          ) : (
            <LatencyBars buckets={buckets} />
          )}
        </ChartCard>
        <ChartCard dense title="Notes" description="Insights worth acting on.">
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[168px] w-full" />
          ) : (
            <InsightsList insights={data?.insights || []} />
          )}
        </ChartCard>
      </div>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-3">
        <ChartCard
          dense
          title="Live websites"
          description="Public origins locked to an agent."
          aside={`${liveSites.length} origin${liveSites.length === 1 ? "" : "s"}`}
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[120px] w-full" />
          ) : liveSites.length === 0 ? (
            <ChartEmpty
              message="No public origins locked yet."
              className="min-h-[120px] h-auto"
            />
          ) : (
            <ul className="max-h-[160px] divide-y divide-border/60 overflow-y-auto">
              {liveSites.map((agent) => (
                <li key={agent.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-foreground">
                      {embedSiteHost(agent.siteKnowledgeOrigin)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {agent.name} · {agent.ownerEmail || "—"}
                    </p>
                  </div>
                  {agent.userId && agent.workspaceId ? (
                    <Link
                      href={`/admin/users/${agent.userId}/workspaces/${agent.workspaceId}/agents/${agent.id}`}
                      className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
        <ChartCard
          dense
          title="Reply mix"
          description="Timed replies by speed bucket."
          className="lg:col-span-2"
        >
          {chartsLoading && !data ? (
            <ChartSkeleton className="h-[88px] w-full" />
          ) : buckets.every((row) => !row.count) ? (
            <ChartEmpty message="No timed replies." className="min-h-[88px] h-auto" />
          ) : (
            <div className="grid h-full min-h-[88px] flex-1 grid-cols-2 overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border/50 sm:grid-cols-5">
              {buckets.map((bucket, index) => {
                const total = buckets.reduce((sum, row) => sum + row.count, 0) || 1;
                const pct = Math.round((bucket.count / total) * 100);
                return (
                  <div
                    key={bucket.id || bucket.label}
                    className={cn(
                      "flex h-full flex-col items-center justify-center gap-1.5 bg-card/80 px-2 py-2 text-center",
                      index < buckets.length - 1 && "border-b border-border/60 sm:border-r sm:border-b-0"
                    )}
                  >
                    <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                      {bucket.label}
                    </p>
                    <p className="text-[18px] font-semibold tabular-nums leading-none text-foreground">
                      {bucket.count}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {pct}%
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      <section className="mt-3 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] md:h-[320px]">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-3">
          <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
            Agents
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {agents.length} total · {AGENT_PAGE_SIZE} / page
          </p>
        </div>
        {chartsLoading && !data ? (
          <p className="flex flex-1 items-center px-3 text-[12px] text-muted-foreground">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="flex flex-1 items-center px-3 text-[12px] text-muted-foreground">No agents.</p>
        ) : (
          <>
            <div className="divide-y divide-border/60 md:hidden">
              {pagedAgents.map((agent) => (
                <article key={agent.id} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {agent.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {agent.ownerEmail || "—"}
                      </p>
                    </div>
                    {agent.userId && agent.workspaceId ? (
                      <Link
                        href={`/admin/users/${agent.userId}/workspaces/${agent.workspaceId}/agents/${agent.id}`}
                        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                      >
                        Inspect
                        <ArrowUpRight className="size-3" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    <div>
                      <dt className="text-muted-foreground">Site</dt>
                      <dd className="truncate text-foreground">
                        {agent.siteKnowledgeOrigin
                          ? embedSiteHost(agent.siteKnowledgeOrigin)
                          : "Off"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Volume</dt>
                      <dd className="tabular-nums text-foreground">
                        {agent.conversations}/{agent.messages} · {agent.percent}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Reply</dt>
                      <dd className="tabular-nums text-foreground">
                        {formatResponseTime(agent.averageResponseTimeMs)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Positive</dt>
                      <dd className="tabular-nums text-foreground">
                        {agent.conversations
                          ? formatPercent(agent.positiveSentimentPercent)
                          : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Topic</dt>
                      <dd className="text-foreground">
                        {formatTopic(agent.mostCommonTopic)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${(agent.conversations / maxChats) * 100}%`,
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden min-h-0 flex-1 overflow-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead className="sticky top-0 z-[1] bg-card">
                <tr className="border-b border-border/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-2.5 py-1.5 font-semibold">Agent / owner</th>
                  <th className="px-2 py-1.5 font-semibold">Site</th>
                  <th className="w-[28%] px-2 py-1.5 font-semibold">Volume</th>
                  <th className="px-2 py-1.5 font-semibold">Reply</th>
                  <th className="px-2 py-1.5 font-semibold">Sentiment</th>
                  <th className="px-2 py-1.5 font-semibold">Topic</th>
                  <th className="px-2.5 py-1.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {pagedAgents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="max-w-[200px] px-2.5 py-1.5">
                      <p className="truncate font-medium text-foreground" title={agent.name}>
                        {agent.name}
                      </p>
                      <p
                        className="truncate text-[11px] text-muted-foreground"
                        title={agent.ownerEmail || ""}
                      >
                        {agent.ownerEmail || "—"}
                      </p>
                    </td>
                    <td className="max-w-[140px] px-2 py-1.5">
                      {agent.siteKnowledgeOrigin ? (
                        <a
                          href={agent.siteKnowledgeOrigin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-primary hover:underline"
                          title={embedSiteHost(agent.siteKnowledgeOrigin)}
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-success)]" />
                          <span className="truncate">
                            {embedSiteHost(agent.siteKnowledgeOrigin)}
                          </span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                          Off
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${(agent.conversations / maxChats) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-[4.5rem] shrink-0 text-right tabular-nums text-foreground">
                          {agent.conversations}
                          <span className="text-muted-foreground">
                            /{agent.messages}
                          </span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {agent.percent}% of chats
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-muted-foreground">
                      {formatResponseTime(agent.averageResponseTimeMs)}
                    </td>
                    <td className="px-2 py-1.5">
                      {agent.conversations ? (
                        <div className="flex items-center gap-2">
                          <SentimentSplit
                            positive={agent.positiveSentimentPercent}
                            negative={agent.negativeSentimentPercent}
                          />
                          <span className="tabular-nums text-[11px] text-muted-foreground">
                            {formatPercent(agent.positiveSentimentPercent)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {formatTopic(agent.mostCommonTopic)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      {agent.userId && agent.workspaceId ? (
                        <Link
                          href={`/admin/users/${agent.userId}/workspaces/${agent.workspaceId}/agents/${agent.id}`}
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                        >
                          Inspect
                          <ArrowUpRight className="size-3" aria-hidden />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <div className="flex h-9 shrink-0 items-center justify-between border-t border-border/60 px-3">
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {agents.length === 0
              ? "0–0"
              : `${(safeAgentPage - 1) * AGENT_PAGE_SIZE + 1}–${Math.min(
                  safeAgentPage * AGENT_PAGE_SIZE,
                  agents.length
                )}`}{" "}
            of {agents.length}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={safeAgentPage <= 1 || loading}
              onClick={() => setAgentPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="min-w-[3.5rem] text-center text-[11px] tabular-nums text-muted-foreground">
              {safeAgentPage} / {agentPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={safeAgentPage >= agentPages || loading}
              onClick={() => setAgentPage((p) => Math.min(agentPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
