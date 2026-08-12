"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { getOverview } from "@/lib/api/analytics";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DashboardShortcuts } from "@/components/dashboard/DashboardShortcuts";
import { buttonVariants } from "@/components/ui/button";
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

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const overviewData = await getOverview();
        if (cancelled) return;
        setOverview(overviewData);
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

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <section className="animate-fade-up overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div
          className="relative px-6 py-8 sm:px-8 sm:py-10"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 10%, white) 0%, white 55%, #f0fdfa 100%)",
          }}
        >
          <p className="text-sm font-medium text-[var(--color-primary)]">
            Workspace overview
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
            {authLoading
              ? "Loading…"
              : `Welcome back${firstName ? `, ${firstName}` : ""}`}
          </h1>
          <p className="mt-3 max-w-xl text-[var(--color-text-secondary)]">
            Track conversations, sentiment, and your AI agents from one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/agents/new" className={cn(buttonVariants())}>
              New agent
            </Link>
            <Link
              href="/agents"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Manage agents
            </Link>
          </div>
        </div>
      </section>

      <section className="animate-fade-up-delay-1 mt-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">
            Quick actions
          </h2>
        </div>
        <DashboardShortcuts />
      </section>

      {error ? (
        <p
          className="mt-6 rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="animate-fade-up-delay-2 mt-10">
        <div className="mb-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">
            Performance
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Live metrics from your stored conversations
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Total Conversations"
            value={overview?.totalConversations ?? 0}
            loading={metricsLoading}
            tone="default"
          />
          <MetricCard
            label="Total Messages"
            value={overview?.totalMessages ?? 0}
            loading={metricsLoading}
            tone="info"
          />
          <MetricCard
            label="Avg Response Time"
            value={formatResponseTime(overview?.averageResponseTimeMs)}
            loading={metricsLoading}
            tone="warning"
          />
          <MetricCard
            label="Positive Sentiment"
            value={formatPercent(overview?.positiveSentimentPercent)}
            loading={metricsLoading}
            tone="positive"
          />
          <MetricCard
            label="Negative Sentiment"
            value={formatPercent(overview?.negativeSentimentPercent)}
            loading={metricsLoading}
            tone="negative"
          />
          <MetricCard
            label="Most Common Topic"
            value={overview?.mostCommonTopic || "No data"}
            loading={metricsLoading}
            tone="default"
          />
        </div>
      </section>
    </main>
  );
}
