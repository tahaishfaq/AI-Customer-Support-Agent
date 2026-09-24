"use client";

import Link from "next/link";
import { AgentHero } from "@/components/agents/AgentHero";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  AppRouteSkeleton,
  LoadingSurface,
} from "@/components/ui/loading-surface";

function AgentStudioSkeleton() {
  return (
    <LoadingSurface label="Loading agent…">
      <AppRouteSkeleton />
    </LoadingSurface>
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
