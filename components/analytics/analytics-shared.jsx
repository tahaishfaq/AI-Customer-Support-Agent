"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Clock,
  Frown,
  Hash,
  MessageCircle,
  MessagesSquare,
  Smile,
} from "lucide-react";
import { getDashboard } from "@/lib/api/analytics";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { cn } from "@/lib/utils";

export const ANALYTICS_RANGES = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

export function formatResponseTime(ms) {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatPercent(value) {
  if (value == null) return "0%";
  return `${value}%`;
}

export function formatTopic(value) {
  if (!value) return "—";
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function embedSiteHost(origin) {
  if (!origin) return "";
  return String(origin).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function zeroHint(value) {
  const n = typeof value === "number" ? value : Number(value);
  return n === 0 || value === "0%" || value === "—" ? "No activity in range" : undefined;
}

export function RangeChips({ range, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ANALYTICS_RANGES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-[12px] font-medium",
            range === item.id
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)] hover:text-[var(--color-text)]"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsKpiGrid({ overview, extra, loading }) {
  const hint = (value) => (loading ? undefined : zeroHint(value));

  return (
    <section
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        extra ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
    >
      {extra}
      <MetricCard
        label="Total Conversations"
        value={overview?.totalConversations ?? 0}
        hint={hint(overview?.totalConversations ?? 0)}
        loading={loading}
        icon={MessagesSquare}
      />
      <MetricCard
        label="Total Messages"
        value={overview?.totalMessages ?? 0}
        hint={hint(overview?.totalMessages ?? 0)}
        loading={loading}
        tone="info"
        icon={MessageCircle}
      />
      <MetricCard
        label="Avg Response Time"
        value={formatResponseTime(overview?.averageResponseTimeMs)}
        hint={hint(overview?.averageResponseTimeMs ?? 0)}
        loading={loading}
        tone="warning"
        icon={Clock}
      />
      <MetricCard
        label="Avg Conversation Length"
        value={overview?.averageConversationLength ?? 0}
        hint={hint(overview?.averageConversationLength ?? 0)}
        loading={loading}
        icon={Hash}
      />
      <MetricCard
        label="Positive Sentiment"
        value={formatPercent(overview?.positiveSentimentPercent)}
        hint={hint(overview?.positiveSentimentPercent ?? 0)}
        loading={loading}
        tone="positive"
        icon={Smile}
      />
      <MetricCard
        label="Negative Sentiment"
        value={formatPercent(overview?.negativeSentimentPercent)}
        hint={hint(overview?.negativeSentimentPercent ?? 0)}
        loading={loading}
        tone="negative"
        icon={Frown}
      />
    </section>
  );
}

export function useAnalyticsDashboard({ agentId, range, loader }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const dashboard = loader
          ? await loader({ agentId, range })
          : await getDashboard({ agentId, range });
        if (!cancelled) setData(dashboard);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load analytics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [agentId, range, loader]);

  return { data, loading, error };
}

export function AnalyticsError({ error }) {
  if (!error) return null;
  return (
    <p
      className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]"
      role="alert"
    >
      {error}
    </p>
  );
}

export function AgentCountCard({ agentCount, activeAgents, loading }) {
  return (
    <MetricCard
      label="Your agents"
      value={agentCount ?? 0}
      hint={
        loading
          ? undefined
          : `${activeAgents ?? 0} with chats in this range`
      }
      loading={loading}
      icon={Bot}
    />
  );
}
