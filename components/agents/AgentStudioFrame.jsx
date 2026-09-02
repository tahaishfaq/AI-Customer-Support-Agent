"use client";

import Link from "next/link";
import { AgentHero } from "@/components/agents/AgentHero";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";

function AgentStudioSkeleton() {
  return (
    <div className="aide-page">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border bg-muted/40 px-2 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-[4.5rem] shrink-0 rounded-md" />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-40 rounded-xl" />
    </div>
  );
}

export function AgentStudioFrame({
  agent,
  loading,
  error,
  deleteOpen,
  onDeleteOpenChange,
  children,
}) {
  if (loading) {
    return <AgentStudioSkeleton />;
  }

  if (error || !agent) {
    return (
      <div className="aide-page">
        <InlineAlert title="Couldn’t load agent">
          {error || "Agent not found"}
        </InlineAlert>
        <Link
          href="/agents"
          className="mt-4 inline-block text-sm font-medium text-primary underline"
        >
          Back to agents
        </Link>
      </div>
    );
  }

  return (
    <div className="aide-page">
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
    </div>
  );
}
