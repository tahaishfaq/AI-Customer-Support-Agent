"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS = {
  knowledge: "Checking the knowledge base",
  http: "Checking your connected service",
  mcp: "Checking connected tools",
  web_search: "Searching the web",
  hybrid: "Comparing store and online information",
};

function labelFor(activity) {
  return activity?.label || LABELS[activity?.mode] || "Working on your request";
}

export function AgentActivityBubble({ activities = [], compact = false }) {
  if (!activities.length) return null;
  const active = activities.find((item) => item.phase === "running" || item.phase === "selected");

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-[12px]",
        "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]",
        compact ? "max-w-full" : "max-w-md"
      )}
      role="status"
      aria-live="polite"
    >
      {active ? (
        <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-text)]">
          {active ? labelFor(active) : "Completed checks"}
        </p>
        {activities.length > 1 ? (
          <p className="mt-0.5 truncate text-[11px]">
            {activities.map(labelFor).join(" · ")}
          </p>
        ) : null}
      </div>
      {activities.some((item) => item.phase === "failed") ? (
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-label="Some checks failed" />
      ) : null}
    </div>
  );
}
