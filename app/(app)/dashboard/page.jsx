"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Frown,
  Hash,
  MessageCircle,
  MessagesSquare,
  Plus,
  Smile,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { getOverview } from "@/lib/api/analytics";
import { listAgents } from "@/lib/api/agents";
import { listConversations } from "@/lib/api/conversations";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DashboardShortcuts } from "@/components/dashboard/DashboardShortcuts";
import { HomeAgentCard } from "@/components/dashboard/HomeAgentCard";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatResponseTime(ms) {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value) {
  if (value == null) return "0%";
  return `${value}%`;
}

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function zeroHint(value) {
  const n = typeof value === "number" ? value : Number(value);
  return n === 0 || value === "0%" || value === "—" ? "No data yet" : undefined;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [overview, setOverview] = useState(null);
  const [agents, setAgents] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [overviewData, agentList, convoData] = await Promise.all([
          getOverview(),
          listAgents(),
          listConversations({ limit: 100, offset: 0 }),
        ]);
        if (cancelled) return;
        setOverview(overviewData);
        setAgents(agentList);
        setConversations(convoData.conversations || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const metricsLoading = loading || authLoading;
  const firstName = user?.name?.split(" ")[0];

  const statsByAgent = useMemo(() => {
    const map = {};
    for (const convo of conversations) {
      const id = convo.agentId;
      if (!map[id]) map[id] = { conversations: 0, messages: 0 };
      map[id].conversations += 1;
      map[id].messages += convo.messageCount || 0;
    }
    return map;
  }, [conversations]);

  const recent = conversations.slice(0, 8);
  const featuredAgents = agents.slice(0, 6);
  const kpiHint = (value) => (metricsLoading ? undefined : zeroHint(value));

  return (
    <main className="aide-page space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
            {authLoading
              ? "Workspace"
              : firstName
                ? `${firstName}'s workspace`
                : "Aide workspace"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversations, sentiment, and agents in one place.
          </p>
        </div>
        <Link
          href="/agents/new"
          className={cn(buttonVariants(), "shrink-0 gap-1.5 self-start sm:self-auto")}
        >
          <Plus className="size-3.5" />
          New agent
        </Link>
      </header>

      {error ? (
        <InlineAlert onRetry={() => setReloadKey((k) => k + 1)}>
          {error}
        </InlineAlert>
      ) : null}

      <section aria-label="Workspace insights" className="min-w-0">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
          <div className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              compact
              label="Conversations"
              value={overview?.totalConversations ?? 0}
              hint={kpiHint(overview?.totalConversations ?? 0)}
              loading={metricsLoading}
              icon={MessagesSquare}
            />
            <MetricCard
              compact
              label="Messages"
              value={overview?.totalMessages ?? 0}
              hint={kpiHint(overview?.totalMessages ?? 0)}
              loading={metricsLoading}
              tone="info"
              icon={MessageCircle}
            />
            <MetricCard
              compact
              label="Avg response"
              value={formatResponseTime(overview?.averageResponseTimeMs)}
              hint={kpiHint(overview?.averageResponseTimeMs ?? 0)}
              loading={metricsLoading}
              tone="warning"
              icon={Clock}
            />
            <MetricCard
              compact
              label="Positive"
              value={formatPercent(overview?.positiveSentimentPercent)}
              hint={kpiHint(overview?.positiveSentimentPercent ?? 0)}
              loading={metricsLoading}
              tone="positive"
              icon={Smile}
            />
            <MetricCard
              compact
              label="Negative"
              value={formatPercent(overview?.negativeSentimentPercent)}
              hint={kpiHint(overview?.negativeSentimentPercent ?? 0)}
              loading={metricsLoading}
              tone="negative"
              icon={Frown}
            />
            <MetricCard
              compact
              label="Top topic"
              value={overview?.mostCommonTopic || "—"}
              hint={overview?.mostCommonTopic ? undefined : "No data yet"}
              loading={metricsLoading}
              icon={Hash}
            />
          </div>
        </div>
      </section>

      <DashboardShortcuts />

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <section className="min-w-0">
          <div className="mb-3 flex h-7 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Agents
              {!loading && agents.length > 0 ? (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({agents.length})
                </span>
              ) : null}
            </h2>
            <Link
              href="/agents"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
          ) : agents.length === 0 ? (
            <EmptyState
              className="rounded-xl border border-dashed border-border py-14"
              title="Create an agent to get started"
              action={
                <Link
                  href="/agents/new"
                  className={cn(buttonVariants({ size: "sm" }), "inline-flex")}
                >
                  New agent
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {featuredAgents.map((agent) => (
                <HomeAgentCard
                  key={agent.id}
                  agent={agent}
                  conversationCount={statsByAgent[agent.id]?.conversations ?? 0}
                  messageCount={statsByAgent[agent.id]?.messages ?? 0}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0 lg:sticky lg:top-20">
          <div className="mb-3 flex h-7 items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Recent activity
            </h2>
            <Link
              href="/inbox"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Inbox
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : recent.length === 0 ? (
              <p className="px-4 py-12 text-center text-[13px] text-muted-foreground">
                No conversations yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {recent.map((convo) => {
                  const name = convo.agent?.name || "Agent";
                  const initial = name.slice(0, 1).toUpperCase();
                  return (
                    <li key={convo.id}>
                      <Link
                        href={`/agents/${convo.agentId}/conversations/${convo.id}`}
                        className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {initial}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">
                            {name}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {convo.category || "GENERAL"} ·{" "}
                            {formatWhen(convo.startedAt)}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                          {convo.messageCount || 0}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
