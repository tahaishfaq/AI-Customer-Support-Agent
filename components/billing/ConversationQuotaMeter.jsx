"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import {
  conversationQuotaPercent,
  conversationQuotaWarningLevel,
  formatQuotaResetLabel,
} from "@/lib/billing/conversation-quota-ui";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function SidebarQuotaCard({ className, atLimit, level, children }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
        atLimit
          ? "border-destructive/35"
          : level === "critical" || level === "warning"
            ? "border-amber-500/35"
            : "border-border/80",
        className
      )}
    >
      {children}
    </div>
  );
}

function SidebarQuotaHeader({ planName, usageLabel, badge }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Conversations
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums text-foreground",
            badge && "rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          )}
        >
          {badge || usageLabel}
        </span>
      </div>
      <p className="truncate text-xs font-medium text-foreground">{planName}</p>
      {badge ? (
        <p className="text-[11px] tabular-nums text-muted-foreground">{usageLabel}</p>
      ) : null}
    </div>
  );
}

function SidebarQuotaAction({ atLimit }) {
  return (
    <Link
      href="/billing/plans"
      className={cn(
        "block border-t border-border/70 px-3 py-2 text-center text-xs font-medium transition-colors",
        atLimit
          ? "bg-destructive/5 text-destructive hover:bg-destructive/10"
          : "text-primary hover:bg-muted/50"
      )}
    >
      {atLimit ? "Upgrade plan" : "Change plan"}
    </Link>
  );
}

function SidebarQuotaIcon({ className, percent, level, title }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href="/billing/plans"
            className={cn(
              "relative mx-auto flex size-8 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted/40 hover:text-foreground",
              level === "exceeded" && "border-destructive/40 text-destructive",
              className
            )}
            aria-label={title}
          />
        }
      >
        <MessageSquare className="size-4" />
        <span
          className={cn(
            "absolute inset-x-1 bottom-1 block h-0.5 overflow-hidden rounded-full bg-muted",
            level === "exceeded" && "bg-destructive/20"
          )}
        >
          <span
            className={cn("block h-full rounded-full", barColor(level))}
            style={{ width: `${Math.max(percent, 8)}%` }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[12rem] text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

function barColor(level) {
  if (level === "exceeded") return "bg-destructive";
  if (level === "critical") return "bg-amber-500";
  if (level === "warning") return "bg-primary";
  return "bg-primary/80";
}

function ProgressBar({ percent, level, className, minFill = 2 }) {
  const width = percent <= 0 ? 0 : Math.max(percent, minFill);
  return (
    <span
      className={cn(
        "block h-1 overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <span
        className={cn("block h-full rounded-full transition-all", barColor(level))}
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

export function ConversationQuotaMeter({
  quota,
  billing,
  variant = "compact",
  className,
  showUpgrade = true,
}) {
  if (!quota) return null;

  const level = conversationQuotaWarningLevel(quota);
  const percent = conversationQuotaPercent(quota);
  const planName =
    billing?.subscription?.plan?.name ||
    billing?.entitlements?.planSlug ||
    "Plan";
  const resetLabel = formatQuotaResetLabel(quota.periodEnd);

  if (quota.unlimited) {
    if (variant === "compact") {
      return (
        <Link
          href="/billing/plans"
          className={cn(
            "hidden max-w-[9rem] items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 md:flex",
            className
          )}
          title={`${quota.used} billable conversations this month`}
        >
          <span className="truncate tabular-nums">{quota.used}</span>
          <span className="text-muted-foreground/70">· ∞</span>
        </Link>
      );
    }

    if (variant === "sidebar") {
      return (
        <SidebarQuotaCard className={className}>
          <div className="space-y-2 px-3 pt-3 pb-2.5">
            <SidebarQuotaHeader
              planName={planName}
              usageLabel={`${quota.used.toLocaleString()} used`}
              badge="Unlimited"
            />
            <p className="text-[11px] text-muted-foreground">No monthly cap on billable chats.</p>
          </div>
          <SidebarQuotaAction atLimit={false} />
        </SidebarQuotaCard>
      );
    }

    if (variant === "sidebar-icon") {
      return (
        <SidebarQuotaIcon
          className={className}
          percent={100}
          level="ok"
          title={`${planName} · Unlimited · ${quota.used.toLocaleString()} this month`}
        />
      );
    }

    if (variant === "strip" || variant === "card") {
      return (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground",
            className
          )}
        >
          <span>
            <span className="font-medium text-foreground tabular-nums">
              {quota.used.toLocaleString()}
            </span>{" "}
            conversations this month · Unlimited ({planName})
          </span>
        </div>
      );
    }

    return null;
  }

  const remaining = quota.remaining ?? Math.max(0, quota.limit - quota.used);
  const atLimit = level === "exceeded";

  if (variant === "compact") {
    return (
      <Link
        href="/billing/plans"
        className={cn(
          "hidden min-w-0 max-w-[7.5rem] items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] transition-colors hover:bg-muted/50 md:flex",
          atLimit
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : "border-border/70 bg-muted/30 text-muted-foreground",
          className
        )}
        title={`${quota.used}/${quota.limit} billable conversations · ${resetLabel}`}
      >
        <span className="shrink-0 font-medium tabular-nums">
          {quota.used}/{quota.limit}
        </span>
        <ProgressBar
          percent={percent}
          level={level}
          className="min-w-[2rem] flex-1"
        />
      </Link>
    );
  }

  if (variant === "sidebar") {
    return (
      <SidebarQuotaCard
        className={className}
        atLimit={atLimit}
        level={level}
      >
        <div className="space-y-2 px-3 pt-3 pb-2.5">
          <SidebarQuotaHeader
            planName={planName}
            usageLabel={`${quota.used}/${quota.limit}`}
          />
          <ProgressBar percent={percent} level={level} className="h-2" minFill={0} />
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {remaining.toLocaleString()} left · {resetLabel}
          </p>
        </div>
        {showUpgrade ? <SidebarQuotaAction atLimit={atLimit} /> : null}
      </SidebarQuotaCard>
    );
  }

  if (variant === "sidebar-icon") {
    return (
      <SidebarQuotaIcon
        className={className}
        percent={percent}
        level={level}
        title={`${planName} · ${quota.used}/${quota.limit} · ${remaining} left · ${resetLabel}`}
      />
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 border-b px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-4",
          atLimit
            ? "border-destructive/30 bg-destructive/5 text-destructive"
            : level === "critical" || level === "warning"
              ? "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100"
              : "border-border bg-muted/20 text-muted-foreground",
          className
        )}
      >
        <p className="min-w-0 leading-snug">
          {atLimit ? (
            <>
              <span className="font-semibold">Limit reached</span> ({quota.used}/
              {quota.limit}). New chats pause until reset or upgrade.
            </>
          ) : (
            <>
              <span className="font-semibold tabular-nums">
                {quota.used}/{quota.limit}
              </span>{" "}
              conversations · {remaining} left · {resetLabel}
            </>
          )}
        </p>
        {showUpgrade ? (
          <Link
            href="/billing/plans"
            className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
          >
            {atLimit ? "Upgrade" : "Plans"}
          </Link>
        ) : null}
      </div>
    );
  }

  // strip + card — single slim row (mobile / billing pages)
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px]",
        atLimit ? "border-destructive/30 bg-destructive/5" : "border-border/60 bg-muted/15",
        className
      )}
    >
      <span className="shrink-0 font-semibold tabular-nums text-foreground">
        {quota.used}/{quota.limit}
      </span>
      <ProgressBar
        percent={percent}
        level={level}
        className="min-w-[3rem] max-w-[4.5rem] flex-1"
      />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {planName} · {remaining} left
      </span>
      {showUpgrade ? (
        <Link
          href="/billing/plans"
          className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
        >
          {atLimit ? "Upgrade" : "Plans"}
        </Link>
      ) : null}
    </div>
  );
}
