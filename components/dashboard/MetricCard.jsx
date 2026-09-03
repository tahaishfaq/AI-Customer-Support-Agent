"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONE = {
  default: "bg-primary/10 text-primary",
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  negative: "bg-destructive/10 text-destructive",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

/** Compact KPI cell for the dashboard insights strip. */
export function MetricCard({
  label,
  value,
  hint,
  loading,
  tone = "default",
  icon: Icon,
  className,
  compact = false,
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "aide-card flex h-full min-w-0 flex-col gap-2 p-3.5 sm:p-4",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-md",
                TONE[tone] || TONE.default
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="min-h-7">
          {loading ? (
            <Skeleton className="h-6 w-14" aria-hidden />
          ) : (
            <p className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight tabular-nums text-foreground">
              {value}
            </p>
          )}
        </div>
        {hint ? (
          <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
        ) : (
          <span className="h-3.5" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <div className={cn("aide-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">
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
      <div className="mt-3 flex min-h-[2.5rem] items-end">
        {loading ? (
          <Skeleton className="h-8 w-20" aria-hidden />
        ) : (
          <p className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold leading-none tracking-tight">
            {value}
          </p>
        )}
      </div>
      <p className="mt-2 min-h-4 text-[11px] text-muted-foreground">
        {loading ? "\u00a0" : hint || ""}
      </p>
    </div>
  );
}
