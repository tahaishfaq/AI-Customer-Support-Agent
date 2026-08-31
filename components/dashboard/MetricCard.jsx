"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE = {
  default: "bg-primary/10 text-primary",
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  negative: "bg-destructive/10 text-destructive",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
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
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <CardDescription className="min-w-0 truncate text-xs font-medium text-muted-foreground">
          {label}
        </CardDescription>
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
      </CardHeader>
      <CardContent>
        {/* Fixed value + hint slots avoid layout shift when skeleton → content */}
        <div className="flex min-h-[2.75rem] items-end">
          {loading ? (
            <Skeleton className="h-8 w-20" aria-hidden />
          ) : (
            <CardTitle className="truncate font-heading text-2xl font-semibold leading-none tracking-tight sm:text-[1.7rem]">
              {value}
            </CardTitle>
          )}
        </div>
        <p className="mt-2 min-h-4 text-[11px] text-muted-foreground">
          {loading ? "\u00a0" : hint || ""}
        </p>
      </CardContent>
    </Card>
  );
}
