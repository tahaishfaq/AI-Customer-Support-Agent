"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONE = {
  default: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  positive: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  negative: "bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
  info: "bg-[var(--color-info)]/10 text-[var(--color-info)]",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
};

export function MetricCard({
  label,
  value,
  hint,
  loading,
  tone = "default",
  icon: Icon,
  className,
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-card)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium leading-snug text-[var(--color-text-secondary)]">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              TONE[tone] || TONE.default
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-4 h-8 w-20 bg-[var(--color-border)]" />
      ) : (
        <div className="mt-3">
          <p className="truncate font-[family-name:var(--font-display)] text-[1.7rem] font-semibold leading-none tracking-tight text-[var(--color-text)]">
            {value}
          </p>
          <p className="mt-2 min-h-[16px] text-[11px] text-[var(--color-muted)]">
            {hint || ""}
          </p>
        </div>
      )}
    </div>
  );
}
