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
import {
  SoftStagger,
  SoftStaggerItem,
} from "@/components/motion/soft-motion";
import { cn } from "@/lib/utils";
import { selectionChipClass } from "@/lib/ui/selection-chip";

export const ANALYTICS_RANGES = [
  { id: "1d", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

export const ANALYTICS_RANGE_IDS = ANALYTICS_RANGES.map((item) => item.id);

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

export function RangeChips({ range, onChange, className }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {ANALYTICS_RANGES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={selectionChipClass(
            range === item.id,
            "rounded-md px-2.5 py-1.5 text-[11px] font-medium sm:px-3 sm:py-1.5 sm:text-[12px]"
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
    <SoftStagger
      as="section"
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        extra ? "lg:grid-cols-4" : "lg:grid-cols-3"
      )}
    >
      {extra ? <SoftStaggerItem>{extra}</SoftStaggerItem> : null}
      <SoftStaggerItem>
        <MetricCard
          label="Total Conversations"
          value={overview?.totalConversations ?? 0}
          hint={hint(overview?.totalConversations ?? 0)}
          loading={loading}
          icon={MessagesSquare}
        />
      </SoftStaggerItem>
      <SoftStaggerItem>
        <MetricCard
          label="Total Messages"
          value={overview?.totalMessages ?? 0}
          hint={hint(overview?.totalMessages ?? 0)}
          loading={loading}
          tone="info"
          icon={MessageCircle}
        />
      </SoftStaggerItem>
      <SoftStaggerItem>
        <MetricCard
          label="Avg Response Time"
          value={formatResponseTime(overview?.averageResponseTimeMs)}
          hint={hint(overview?.averageResponseTimeMs ?? 0)}
          loading={loading}
          tone="warning"
          icon={Clock}
        />
      </SoftStaggerItem>
      <SoftStaggerItem>
        <MetricCard
          label="Avg Conversation Length"
          value={overview?.averageConversationLength ?? 0}
          hint={hint(overview?.averageConversationLength ?? 0)}
          loading={loading}
          icon={Hash}
        />
      </SoftStaggerItem>
      <SoftStaggerItem>
        <MetricCard
          label="Positive Sentiment"
          value={formatPercent(overview?.positiveSentimentPercent)}
          hint={hint(overview?.positiveSentimentPercent ?? 0)}
          loading={loading}
          tone="positive"
          icon={Smile}
        />
      </SoftStaggerItem>
      <SoftStaggerItem>
        <MetricCard
          label="Negative Sentiment"
          value={formatPercent(overview?.negativeSentimentPercent)}
          hint={hint(overview?.negativeSentimentPercent ?? 0)}
          loading={loading}
          tone="negative"
          icon={Frown}
        />
      </SoftStaggerItem>
    </SoftStagger>
  );
}

export function useAnalyticsDashboard({
  agentId,
  range,
  loader,
  enabled = true,
  keepPrevious = true,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
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
          if (!keepPrevious) setData(null);
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
  }, [agentId, range, loader, enabled, keepPrevious, reloadKey]);

  return {
    data,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
  };
}

export function AnalyticsError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div
      className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3"
      role="alert"
    >
      <p className="text-sm text-[var(--color-danger)]">{error}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          Try again
        </button>
      ) : null}
    </div>
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
