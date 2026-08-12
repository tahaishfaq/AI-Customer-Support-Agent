"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONE = {
  default: "from-[var(--color-primary)]/12 to-transparent",
  positive: "from-[var(--color-success)]/12 to-transparent",
  negative: "from-[var(--color-danger)]/12 to-transparent",
  info: "from-[var(--color-info)]/12 to-transparent",
  warning: "from-[var(--color-warning)]/12 to-transparent",
};

const DOT = {
  default: "bg-[var(--color-primary)]",
  positive: "bg-[var(--color-success)]",
  negative: "bg-[var(--color-danger)]",
  info: "bg-[var(--color-info)]",
  warning: "bg-[var(--color-warning)]",
};

export function MetricCard({ label, value, loading, tone = "default", className }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br",
          TONE[tone] || TONE.default
        )}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span
            className={cn("size-1.5 rounded-full", DOT[tone] || DOT.default)}
          />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </p>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-9 w-24 bg-[var(--color-border)]" />
        ) : (
          <p className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
