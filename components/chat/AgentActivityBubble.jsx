"use client";

import { Check, CircleAlert, Pause } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { activityLabel, normalizeActivityEvent } from "@/lib/chat/activity-state";
import { cn } from "@/lib/utils";

export function AgentActivityBubble({ activities = [], compact = false, themed = false }) {
  const visible = activities.filter(item => normalizeActivityEvent(item) && item.mode !== "preparation");
  if (!visible.length) return null;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-1 rounded-xl border px-3 py-2 text-xs",
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
      {visible.map(item => {
        const running = ["selected", "validating", "running"].includes(item.phase);
        const paused = ["needs_confirmation", "needs_identity", "cancelled"].includes(item.phase);
        const Icon = running ? Spinner : paused ? Pause : item.phase === "failed" ? CircleAlert : Check;
        return (
          <div key={item.activityId} className="flex min-w-0 items-start gap-2" data-phase={item.phase}>
            <Icon className="mt-0.5 size-3.5 shrink-0 motion-reduce:animate-none" aria-hidden="true" role="presentation" />
            <span className="min-w-0 break-words">{activityLabel(item)}</span>
          </div>
        );
      })}
    </div>
  );
}
