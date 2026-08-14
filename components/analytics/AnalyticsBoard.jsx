"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Frown,
  Hash,
  MessageCircle,
  MessagesSquare,
  Smile,
} from "lucide-react";
import { getOverview } from "@/lib/api/analytics";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  DemoInsights,
  DemoSentimentChart,
  DemoTopicChart,
  DemoTrendChart,
} from "@/components/analytics/DemoCharts";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

function formatResponseTime(ms) {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value) {
  if (value == null) return "0%";
  return `${value}%`;
}

function zeroHint(value) {
  const n = typeof value === "number" ? value : Number(value);
  return n === 0 || value === "0%" || value === "—" ? "No change" : undefined;
}

function ChartCard({ title, children }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
        <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
          Demo
        </span>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function AnalyticsBoard({ agentId }) {
  const [range, setRange] = useState("7d");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getOverview({ agentId });
        if (!cancelled) setOverview(data);
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
  }, [agentId]);

  const hint = (value) => (loading ? undefined : zeroHint(value));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRange(item.id)}
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

      {error ? (
        <p
          className="mt-4 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Conversation trend">
          <DemoTrendChart range={range} />
        </ChartCard>
        <ChartCard title="Topic distribution">
          <DemoTopicChart range={range} />
        </ChartCard>
        <ChartCard title="Sentiment distribution">
          <DemoSentimentChart range={range} />
        </ChartCard>
        <ChartCard title="Business insights">
          <DemoInsights />
        </ChartCard>
      </div>
    </div>
  );
}
