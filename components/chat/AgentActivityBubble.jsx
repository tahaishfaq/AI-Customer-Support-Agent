"use client";

import { Check, CircleAlert, Pause } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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

export function AgentActivityBubble({
  activities = [],
  compact = false,
  themed = false,
  fallbackLabel = null,
}) {
  const visible = activities.filter((item) => normalizeActivityEvent(item));
  if (!visible.length && !fallbackLabel) return null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-1 rounded-md border px-3 py-2 text-xs",
        compact ? "max-w-full" : "max-w-md"
      )}
      style={{
        borderColor: themed ? "var(--wc-border)" : "var(--color-border)",
        background: themed ? "var(--wc-shell)" : "var(--color-surface)",
        color: themed ? "var(--wc-shell-fg)" : "var(--color-text)",
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="agent-activity"
    >
      {!visible.length && fallbackLabel ? (
        <div className="flex min-w-0 items-start gap-2" data-phase="running">
          <Spinner
            className="mt-0.5 size-3.5 shrink-0 motion-reduce:animate-none"
            aria-hidden="true"
            role="presentation"
          />
          <span className="min-w-0 break-words">{fallbackLabel}</span>
        </div>
      ) : null}
      {visible.map((item) => {
        const running = isRunningPhase(item);
        const paused = ["needs_confirmation", "needs_identity", "cancelled"].includes(
          item.phase
        );
        return (
          <div
            key={item.activityId}
            className="flex min-w-0 items-start gap-2"
            data-phase={item.phase}
          >
            {running ? (
              <Spinner
                className="mt-0.5 size-3.5 shrink-0 motion-reduce:animate-none"
                aria-hidden="true"
                role="presentation"
              />
            ) : paused ? (
              <Pause
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
                role="presentation"
              />
            ) : item.phase === "failed" ? (
              <CircleAlert
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
                role="presentation"
              />
            ) : (
              <Check
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
                role="presentation"
              />
            )}
            <span className="min-w-0 break-words">{activityLabel(item)}</span>
          </div>
        );
      })}
    </div>
  );
}
