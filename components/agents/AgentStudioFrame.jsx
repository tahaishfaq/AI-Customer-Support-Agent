"use client";

import Link from "next/link";
import { AgentHero } from "@/components/agents/AgentHero";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { Skeleton } from "@/components/ui/skeleton";

export function AgentStudioFrame({
  agent,
  loading,
  error,
  deleteOpen,
  onDeleteOpenChange,
  children,
}) {
  if (loading) {
    return (
      <main className="hapy-page">
        <Skeleton className="h-40 w-full rounded-xl bg-[var(--color-border)]" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl bg-[var(--color-border)]" />
          <Skeleton className="h-24 rounded-xl bg-[var(--color-border)]" />
          <Skeleton className="h-24 rounded-xl bg-[var(--color-border)]" />
        </div>
        <Skeleton className="mt-6 h-72 w-full rounded-xl bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="hapy-page">
        <p className="text-sm text-[var(--color-danger)]">
          {error || "Agent not found"}
        </p>
        <Link
          href="/agents"
          className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] underline"
        >
          Back to agents
        </Link>
      </main>
    );
  }

  return (
    <main className="hapy-page">
      <AgentHero
        agent={agent}
        onDelete={() => onDeleteOpenChange(true)}
      />
      <div className="mt-6">
        {typeof children === "function" ? children(agent) : children}
      </div>
      <DeleteAgentDialog
        agent={agent}
        open={deleteOpen}
        onOpenChange={onDeleteOpenChange}
      />
    </main>
  );
}
