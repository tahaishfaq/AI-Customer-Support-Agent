"use client";

import { activityLabel, normalizeActivityEvent } from "@/lib/chat/activity-state";
import { cn } from "@/lib/utils";

function isRunningPhase(item) {
  if (["selected", "validating", "running"].includes(item.phase)) return true;
  if (
    item.mode === "preparation" &&
    !["completed", "failed", "cancelled"].includes(item.phase)
  ) {
    return true;
  }
  return false;
}

function pillText(item) {
  if (item.phase === "needs_confirmation") {
    return "CONFIRM → ACTION";
  }
  const raw = String(activityLabel(item) || "WORKING")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return raw.slice(0, 28) || "WORKING";
}

export function AgentActivityBubble({
  activities = [],
  compact = false,
  themed = false,
  fallbackLabel = null,
  hideCompleted = false,
}) {
  const visible = [];
  const byMode = new Map();
  for (const item of activities) {
    if (!normalizeActivityEvent(item)) continue;
    if (item.mode === "preparation") continue;
    if (hideCompleted && ["completed", "failed", "cancelled"].includes(item.phase)) {
      continue;
    }
    byMode.set(item.mode, item);
  }
  for (const item of byMode.values()) visible.push(item);
  if (!visible.length && !fallbackLabel) return null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-1.5",
        compact ? "max-w-full" : "max-w-md"
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="agent-activity"
    >
      {!visible.length && fallbackLabel ? (
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide",
            themed
              ? "border-[var(--wc-border)] bg-[var(--wc-shell)] text-[var(--wc-shell-fg)]"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
          )}
          data-phase="running"
        >
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              themed ? "bg-[var(--wc-primary)]" : "bg-[var(--color-primary)]",
              "motion-safe:animate-pulse"
            )}
            aria-hidden
          />
          <span className="min-w-0 break-words">{fallbackLabel}</span>
        </span>
      ) : null}
      {visible.map((item) => {
        const running = isRunningPhase(item);
        const failed = item.phase === "failed";
        return (
          <span
            key={item.activityId}
            className={cn(
              "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide",
              themed
                ? "border-[var(--wc-border)] bg-[var(--wc-shell)] text-[var(--wc-shell-fg)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
            )}
            data-phase={item.phase}
            title={activityLabel(item)}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                failed
                  ? "bg-red-500"
                  : themed
                    ? "bg-[var(--wc-primary)]"
                    : "bg-[var(--color-primary)]",
                running && "motion-safe:animate-pulse"
              )}
              aria-hidden
            />
            <span className="min-w-0 truncate">{pillText(item)}</span>
          </span>
        );
      })}
    </div>
  );
}
