"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { getAdminPlatformDashboard } from "@/lib/api/admin";
import {
  AnalyticsError,
  embedSiteHost,
  formatPercent,
  formatResponseTime,
  formatTopic,
  useAnalyticsDashboard,
} from "@/components/analytics/analytics-shared";
import {
  ActivityHeatmap,
  PlatformGrowthChart,
  StackedSentimentChart,
} from "@/components/analytics/WorkspaceCharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useUrlTab } from "@/hooks/use-url-tab";

const RANGES = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All" },
];

const AGENT_PAGE_SIZE = 6;

const volumeConfig = {
  conversations: { label: "Chats", color: "var(--chart-1)" },
  messages: { label: "Messages", color: "var(--chart-2)" },
};

function Panel({ title, aside, children, className }) {
  return (
    <section
      className={cn(
        "flex h-full min-w-0 min-h-0 flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-white",
        className
      )}
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-2.5">
        <h2 className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {title}
        </h2>
        {aside ? (
          <div className="min-w-0 shrink-0 text-[11px] tabular-nums text-[var(--color-text-secondary)]">
            {aside}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">{children}</div>
    </section>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div className="min-w-0 px-2.5 py-1.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-[15px] font-semibold tabular-nums leading-tight text-[var(--color-text)]",
          warn && "text-[var(--color-danger)]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Empty({ children }) {
  return (
    <p className="flex min-h-[88px] flex-1 items-center justify-center px-2 text-center text-[12px] text-[var(--color-muted)]">
      {children}
    </p>
  );
}

function VolumeChart({ points }) {
  const has = points.some(
    (p) => Number(p.conversations) > 0 || Number(p.messages) > 0
  );
  if (!has) return <Empty>No chat volume in this range.</Empty>;

  return (
    <ChartContainer
      config={volumeConfig}
      className="aspect-auto h-[168px] w-full min-w-0"
    >
      <AreaChart data={points} margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="adminFillChats" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-conversations)" stopOpacity={0.7} />
            <stop offset="95%" stopColor="var(--color-conversations)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="adminFillMsgs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-messages)" stopOpacity={0.55} />
            <stop offset="95%" stopColor="var(--color-messages)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          minTickGap={28}
          fontSize={10}
          tickFormatter={(value) => {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return String(value);
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          }}
        />
        <YAxis tickLine={false} axisLine={false} width={24} allowDecimals={false} fontSize={10} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return String(value);
                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="messages"
          type="monotone"
          fill="url(#adminFillMsgs)"
          stroke="var(--color-messages)"
          strokeWidth={1.5}
        />
        <Area
          dataKey="conversations"
          type="monotone"
          fill="url(#adminFillChats)"
          stroke="var(--color-conversations)"
          strokeWidth={1.5}
        />
      </AreaChart>
    </ChartContainer>
  );
}

const TOPIC_COLORS = {
  SUPPORT: "#0b5f58",
  SALES: "#0284c7",
  PRICING: "#d97706",
  TECHNICAL: "#7c3aed",
  GENERAL: "#64748b",
};

function Composition({ rows, empty }) {
  const total = rows.reduce((sum, row) => sum + (row.count || 0), 0);
  if (!total) return <Empty>{empty}</Empty>;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-2 shrink-0 overflow-hidden rounded-sm bg-[var(--color-bg)]">
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
      <ul className="mt-2 flex min-h-0 flex-1 flex-col justify-evenly">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-[11px] leading-none">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: row.color }}
            />
            <span className="w-[4.25rem] shrink-0 truncate text-[var(--color-text-secondary)]">
              {row.label}
            </span>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.percent || 0}%`,
                  background: row.color,
                  opacity: row.count ? 1 : 0.25,
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right tabular-nums text-[var(--color-text)]">
              {row.count}
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums text-[var(--color-muted)]">
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
  if (!total) return <Empty>No timed replies.</Empty>;

  const colors = {
    fast: "#16a34a",
    ok: "#0b5f58",
    avg: "#d97706",
    slow: "#ea580c",
    heavy: "#dc2626",
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-2 shrink-0 overflow-hidden rounded-sm bg-[var(--color-bg)]">
        {buckets
          .filter((row) => row.count > 0)
          .map((row) => (
            <div
              key={row.id || row.label}
              title={`${row.label}: ${row.count}`}
              style={{
                width: `${(row.count / total) * 100}%`,
                background: colors[row.id] || "#64748b",
              }}
            />
          ))}
      </div>
      <ul className="mt-2 flex min-h-0 flex-1 flex-col justify-evenly">
        {buckets.map((row) => {
          const pct = Number(((row.count / total) * 100).toFixed(1));
          return (
            <li
              key={row.id || row.label}
              className="flex items-center gap-2 text-[11px] leading-none"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: colors[row.id] || "#64748b" }}
              />
              <span className="w-12 shrink-0 text-[var(--color-text-secondary)]">
                {row.label}
              </span>
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: colors[row.id] || "#64748b",
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-[var(--color-text)]">
                {row.count}
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-[var(--color-muted)]">
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
    <div className="flex h-1.5 w-[72px] overflow-hidden rounded-full bg-[var(--color-bg)]">
      <div className="h-full bg-[var(--color-success)]" style={{ width: `${pos}%` }} />
      <div className="h-full bg-slate-300" style={{ width: `${rest}%` }} />
      <div className="h-full bg-[var(--color-danger)]" style={{ width: `${neg}%` }} />
    </div>
  );
}

export function AdminPlatformAnalytics() {
  const [range, setRange] = useUrlTab("range", ["7d", "30d", "all"], "7d");
  const loader = useCallback(
    ({ range: nextRange } = {}) => getAdminPlatformDashboard({ range: nextRange }),
    []
  );
  const { data, loading, error } = useAnalyticsDashboard({ range, loader });
  const overview = data?.overview;
  const platform = data?.platform;
  const agents = data?.agents || [];
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
    { key: "POSITIVE", label: "Positive", color: "#16a34a" },
    { key: "NEUTRAL", label: "Neutral", color: "#94a3b8" },
    { key: "NEGATIVE", label: "Negative", color: "#dc2626" },
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
    <main className="hapy-page !px-4 !py-3 lg:!px-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
            Dashboard
          </h1>
          <p className="text-[11px] text-[var(--color-muted)]">
            All tenants · range applied to chats, growth, and agent volume
          </p>
        </div>
        <div className="inline-flex rounded border border-[var(--color-border)] bg-white p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-medium",
                range === item.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <AnalyticsError error={error} />

      <section className="mt-2 grid grid-cols-2 overflow-hidden rounded-md border border-[var(--color-border)] bg-white sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11 [&>div]:border-b [&>div]:border-r [&>div]:border-[var(--color-border)]">
        <Stat label="Users" value={loading ? "—" : platform?.users ?? 0} />
        <Stat label="Spaces" value={loading ? "—" : platform?.workspaces ?? 0} />
        <Stat label="Agents" value={loading ? "—" : platform?.agents ?? 0} />
        <Stat label="Live sites" value={loading ? "—" : platform?.liveEmbeds ?? 0} />
        <Stat label="Embed %" value={loading ? "—" : `${embedRate}%`} />
        <Stat
          label="Active agents"
          value={loading ? "—" : `${activeAgents}/${platform?.agents ?? 0}`}
        />
        <Stat
          label="Chats"
          value={loading ? "—" : overview?.totalConversations ?? 0}
        />
        <Stat label="Messages" value={loading ? "—" : overview?.totalMessages ?? 0} />
        <Stat
          label="Avg reply"
          value={loading ? "—" : formatResponseTime(overview?.averageResponseTimeMs)}
        />
        <Stat
          label="Positive"
          value={loading ? "—" : formatPercent(overview?.positiveSentimentPercent)}
        />
        <Stat
          label="Negative"
          value={loading ? "—" : formatPercent(overview?.negativeSentimentPercent)}
          warn={(overview?.negativeSentimentPercent || 0) >= 25}
        />
      </section>

      <div className="mt-2 grid min-w-0 gap-2 lg:grid-cols-2">
        <Panel title="Growth" aside="new users / agents / sites / chats">
          {loading ? (
            <div className="h-[168px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (
            <PlatformGrowthChart
              points={data?.growth?.points || []}
              className="h-[168px]"
            />
          )}
        </Panel>
        <Panel title="Chat volume" aside={`${overview?.totalConversations ?? 0} chats`}>
          {loading ? (
            <div className="h-[168px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (
            <VolumeChart points={data?.trends?.points || []} />
          )}
        </Panel>
      </div>

      <div className="mt-2 grid min-w-0 gap-2 lg:grid-cols-3">
        <Panel title="Reach hours" aside={data?.heatmap?.peak?.label || "—"} className="lg:col-span-1">
          {loading ? (
            <div className="h-[148px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (
            <ActivityHeatmap heatmap={data?.heatmap} compact />
          )}
        </Panel>
        <Panel
          title="Topics"
          aside={`${overview?.totalConversations ?? 0} chats`}
        >
          {loading ? (
            <div className="h-[120px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (
            <Composition rows={topicRows} empty="No categorized chats yet." />
          )}
        </Panel>
        <Panel title="Sentiment mix">
          {loading ? (
            <div className="h-[120px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (
            <Composition rows={sentimentRows} empty="No labeled sentiment yet." />
          )}
        </Panel>
      </div>

      <div className="mt-2 grid min-w-0 gap-2 lg:grid-cols-3">
        <Panel title="Sentiment trend" className="lg:col-span-1">
          {loading ? (
            <div className="h-[168px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (
            <StackedSentimentChart
              points={data?.sentimentTrend || []}
              className="h-full min-h-[160px] flex-1"
            />
          )}
        </Panel>
        <Panel
          title="Latency buckets"
          aside={formatResponseTime(overview?.averageResponseTimeMs)}
        >
          {loading ? (
            <div className="h-[120px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (
            <LatencyBars buckets={buckets} />
          )}
        </Panel>
        <Panel title="Notes">
          {loading ? (
            <div className="h-[168px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : (data?.insights || []).length === 0 ? (
            <Empty>No notes for this range.</Empty>
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col justify-evenly overflow-y-auto">
              {(data.insights || []).map((item) => (
                <li key={item.title} className="border-b border-[var(--color-border)] py-1 last:border-0">
                  <p className="text-[12px] font-medium leading-snug text-[var(--color-text)]">
                    {item.title}
                  </p>
                  <p className="text-[11px] leading-snug text-[var(--color-muted)]">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-2 grid min-w-0 gap-2 lg:grid-cols-3">
        <Panel
          title="Live websites"
          aside={`${liveSites.length} origin${liveSites.length === 1 ? "" : "s"}`}
        >
          {loading ? (
            <div className="h-[120px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : liveSites.length === 0 ? (
            <Empty>No public origins locked yet.</Empty>
          ) : (
            <ul className="max-h-[160px] divide-y divide-[var(--color-border)] overflow-y-auto">
              {liveSites.map((agent) => (
                <li key={agent.id} className="flex items-center justify-between gap-2 py-1">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-[var(--color-text)]">
                      {embedSiteHost(agent.siteKnowledgeOrigin)}
                    </p>
                    <p className="truncate text-[11px] text-[var(--color-muted)]">
                      {agent.name} · {agent.ownerEmail || "—"}
                    </p>
                  </div>
                  {agent.userId && agent.workspaceId ? (
                    <Link
                      href={`/admin/users/${agent.userId}/workspaces/${agent.workspaceId}/agents/${agent.id}`}
                      className="shrink-0 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Reply mix" className="lg:col-span-2">
          {loading ? (
            <div className="h-[88px] animate-pulse rounded bg-[var(--color-bg)]" />
          ) : buckets.every((row) => !row.count) ? (
            <Empty>No timed replies.</Empty>
          ) : (
            <div className="grid h-full min-h-[88px] flex-1 grid-cols-5 overflow-hidden rounded-sm bg-[var(--color-border)]">
              {buckets.map((bucket, index) => {
                const total = buckets.reduce((sum, row) => sum + row.count, 0) || 1;
                const pct = Math.round((bucket.count / total) * 100);
                return (
                  <div
                    key={bucket.id || bucket.label}
                    className={cn(
                      "flex h-full flex-col items-center justify-center gap-1.5 bg-white px-2 py-2 text-center",
                      index < buckets.length - 1 && "border-r border-[var(--color-border)]"
                    )}
                  >
                    <p className="truncate text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                      {bucket.label}
                    </p>
                    <p className="text-[18px] font-semibold tabular-nums leading-none text-[var(--color-text)]">
                      {bucket.count}
                    </p>
                    <p className="text-[11px] tabular-nums text-[var(--color-muted)]">
                      {pct}%
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <section className="mt-2 flex h-[320px] min-w-0 flex-col overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Agents
          </h2>
          <p className="text-[11px] text-[var(--color-muted)]">
            {agents.length} total · {AGENT_PAGE_SIZE} / page
          </p>
        </div>
        {loading ? (
          <p className="flex flex-1 items-center px-3 text-[12px] text-[var(--color-muted)]">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="flex flex-1 items-center px-3 text-[12px] text-[var(--color-muted)]">No agents.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead className="sticky top-0 z-[1] bg-white">
                <tr className="border-b border-[var(--color-border)] text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
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
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]"
                  >
                    <td className="max-w-[200px] px-2.5 py-1.5">
                      <p className="truncate font-medium text-[var(--color-text)]" title={agent.name}>
                        {agent.name}
                      </p>
                      <p
                        className="truncate text-[11px] text-[var(--color-muted)]"
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
                          className="flex items-center gap-1.5 text-[var(--color-primary)] hover:underline"
                          title={embedSiteHost(agent.siteKnowledgeOrigin)}
                        >
                          <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-success)]" />
                          <span className="truncate">
                            {embedSiteHost(agent.siteKnowledgeOrigin)}
                          </span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
                          <span className="size-1.5 shrink-0 rounded-full bg-slate-300" />
                          Off
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-bg)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-primary)]"
                            style={{
                              width: `${(agent.conversations / maxChats) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-[4.5rem] shrink-0 text-right tabular-nums text-[var(--color-text)]">
                          {agent.conversations}
                          <span className="text-[var(--color-muted)]">
                            /{agent.messages}
                          </span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] tabular-nums text-[var(--color-muted)]">
                        {agent.percent}% of chats
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-[var(--color-text-secondary)]">
                      {formatResponseTime(agent.averageResponseTimeMs)}
                    </td>
                    <td className="px-2 py-1.5">
                      {agent.conversations ? (
                        <div className="flex items-center gap-2">
                          <SentimentSplit
                            positive={agent.positiveSentimentPercent}
                            negative={agent.negativeSentimentPercent}
                          />
                          <span className="tabular-nums text-[11px] text-[var(--color-muted)]">
                            {formatPercent(agent.positiveSentimentPercent)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-[var(--color-text-secondary)]">
                      {formatTopic(agent.mostCommonTopic)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      {agent.userId && agent.workspaceId ? (
                        <Link
                          href={`/admin/users/${agent.userId}/workspaces/${agent.workspaceId}/agents/${agent.id}`}
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
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
        )}
        <div className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--color-border)] px-2.5">
          <p className="text-[11px] tabular-nums text-[var(--color-muted)]">
            {agents.length === 0
              ? "0–0"
              : `${(safeAgentPage - 1) * AGENT_PAGE_SIZE + 1}–${Math.min(
                  safeAgentPage * AGENT_PAGE_SIZE,
                  agents.length
                )}`}{" "}
            of {agents.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeAgentPage <= 1 || loading}
              onClick={() => setAgentPage((p) => Math.max(1, p - 1))}
              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="min-w-[3.5rem] text-center text-[11px] tabular-nums text-[var(--color-muted)]">
              {safeAgentPage} / {agentPages}
            </span>
            <button
              type="button"
              disabled={safeAgentPage >= agentPages || loading}
              onClick={() => setAgentPage((p) => Math.min(agentPages, p + 1))}
              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
