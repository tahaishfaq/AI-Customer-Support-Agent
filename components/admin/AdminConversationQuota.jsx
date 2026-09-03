"use client";

import {
  conversationQuotaPercent,
  conversationQuotaWarningLevel,
  formatQuotaResetLabel,
} from "@/lib/billing/conversation-quota-ui";
import { cn } from "@/lib/utils";

function ProgressBar({ percent, level, className }) {
  const color =
    level === "exceeded"
      ? "bg-destructive"
      : level === "critical"
        ? "bg-amber-500"
        : level === "warning"
          ? "bg-primary"
          : "bg-primary/80";

  return (
    <span
      className={cn(
        "block h-1.5 overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <span
        className={cn("block h-full rounded-full transition-all", color)}
        style={{ width: `${Math.max(percent, 2)}%` }}
      />
    </span>
  );
}

export function AdminConversationQuota({ quota, className }) {
  if (!quota) return null;

  if (quota.unlimited) {
    return (
      <section className={cn("aide-card px-4 py-3.5", className)}>
        <h2 className="text-sm font-semibold text-foreground">
          Conversation limit
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {quota.used.toLocaleString()}
          </span>{" "}
          billable this month ·{" "}
          <span className="font-medium text-foreground">Unlimited</span>
          {quota.planName ? ` (${quota.planName})` : ""}
        </p>
      </section>
    );
  }

  const level = conversationQuotaWarningLevel(quota);
  const percent = conversationQuotaPercent(quota);
  const remaining = quota.remaining ?? Math.max(0, (quota.limit || 0) - quota.used);
  const atLimit = level === "exceeded";

  return (
    <section
      className={cn(
        "aide-card px-4 py-3.5",
        atLimit && "border-destructive/40",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Conversation limit
        </h2>
        {quota.planName ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {quota.planName}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {quota.used}
          <span className="text-base font-medium text-muted-foreground">
            /{quota.limit}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {remaining} left · {formatQuotaResetLabel(quota.periodEnd)}
        </p>
      </div>

      <ProgressBar percent={percent} level={level} className="mt-3" />

      <p className="mt-2 text-[11px] text-muted-foreground">
        Billable when a chat has 2+ visitor messages in the calendar month.
      </p>
    </section>
  );
}
