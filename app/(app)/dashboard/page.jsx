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
  return n === 0 || value === "0%" || value === "—" ? "No change" : undefined;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [overview, setOverview] = useState(null);
  const [agents, setAgents] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  }, []);

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

  const recent = conversations.slice(0, 6);

  const kpiHint = (value) => (metricsLoading ? undefined : zeroHint(value));

  return (
    <main className="hapy-page">
      <header className="hapy-card flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] font-[family-name:var(--font-display)] text-lg font-semibold text-white">
            H
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-text)] sm:text-2xl">
              {authLoading
                ? "Workspace"
                : firstName
                  ? `${firstName}'s workspace`
                  : "Hapy workspace"}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Conversations, sentiment, and agents in one place.
            </p>
          </div>
        </div>
        <Link
          href="/agents/new"
          className={cn(buttonVariants(), "shrink-0 gap-1.5")}
        >
          <Plus className="size-3.5" />
          New agent
        </Link>
      </header>

      <section className="mt-6">
        <DashboardShortcuts />
      </section>

      {error ? (
        <p
          className="mt-5 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Total Conversations"
            value={overview?.totalConversations ?? 0}
            hint={kpiHint(overview?.totalConversations ?? 0)}
            loading={metricsLoading}
            icon={MessagesSquare}
          />
          <MetricCard
            label="Total Messages"
            value={overview?.totalMessages ?? 0}
            hint={kpiHint(overview?.totalMessages ?? 0)}
            loading={metricsLoading}
            tone="info"
            icon={MessageCircle}
          />
          <MetricCard
            label="Avg Response Time"
            value={formatResponseTime(overview?.averageResponseTimeMs)}
            hint={kpiHint(overview?.averageResponseTimeMs ?? 0)}
            loading={metricsLoading}
            tone="warning"
            icon={Clock}
          />
          <MetricCard
            label="Positive Sentiment"
            value={formatPercent(overview?.positiveSentimentPercent)}
            hint={kpiHint(overview?.positiveSentimentPercent ?? 0)}
            loading={metricsLoading}
            tone="positive"
            icon={Smile}
          />
          <MetricCard
            label="Negative Sentiment"
            value={formatPercent(overview?.negativeSentimentPercent)}
            hint={kpiHint(overview?.negativeSentimentPercent ?? 0)}
            loading={metricsLoading}
            tone="negative"
            icon={Frown}
          />
          <MetricCard
            label="Most Common Topic"
            value={overview?.mostCommonTopic || "—"}
            hint={overview?.mostCommonTopic ? undefined : "No change"}
            loading={metricsLoading}
            icon={Hash}
          />
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Agents
            </h2>
            <Link
              href="/agents"
              className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-48 rounded-xl bg-[var(--color-border)]" />
              <Skeleton className="h-48 rounded-xl bg-[var(--color-border)]" />
              <Skeleton className="h-48 rounded-xl bg-[var(--color-border)]" />
            </div>
          ) : agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center">
              <p className="text-sm font-medium text-[var(--color-text)]">
                Create an agent to get started.
              </p>
              <Link
                href="/agents/new"
                className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
              >
                New agent
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
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

        <aside>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Recent activity
            </h2>
            <Link
              href="/conversations"
              className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="hapy-card min-h-[280px]">
            {loading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-12 bg-[var(--color-border)]" />
                <Skeleton className="h-12 bg-[var(--color-border)]" />
                <Skeleton className="h-12 bg-[var(--color-border)]" />
              </div>
            ) : recent.length === 0 ? (
              <p className="px-5 py-16 text-center text-[13px] text-[var(--color-muted)]">
                No conversations yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {recent.map((convo) => (
                  <li key={convo.id}>
                    <Link
                      href={`/conversations/${convo.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-[var(--color-bg)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-[var(--color-text)]">
                          {convo.agent?.name || "Agent"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
                          {convo.category || "GENERAL"} · {formatWhen(convo.startedAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                        {convo.messageCount || 0} msgs
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
