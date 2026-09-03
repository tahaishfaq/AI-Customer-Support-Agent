"use client";

import { cn } from "@/lib/utils";

export function BillingIntervalToggle({
  value = "month",
  onChange,
  className,
  showYearlySave = true,
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm",
        className
      )}
      role="group"
      aria-label="Billing interval"
    >
      <button
        type="button"
        onClick={() => onChange?.("month")}
        className={cn(
          "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
          value === "month"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange?.("year")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
          value === "year"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Yearly
        {showYearlySave ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
              value === "year"
                ? "bg-background/15 text-background"
                : "bg-primary/12 text-primary"
            )}
          >
            Save ~17%
          </span>
        ) : null}
      </button>
    </div>
  );
}
