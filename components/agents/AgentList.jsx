"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, LayoutGrid, List, Plus, Search } from "lucide-react";
import { listAgents } from "@/lib/api/agents";
import { queryKeys } from "@/lib/query/keys";
import { AgentCard } from "@/components/agents/AgentCard";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export function AgentList() {
  const queryClient = useQueryClient();
  const { data: agents = [], isPending: loading, error: queryError, refetch } = useQuery({
    queryKey: queryKeys.agents.all,
    queryFn: listAgents,
  });
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const error = queryError?.message || "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) =>
      (agent.name || "").toLowerCase().includes(q)
    );
  }, [agents, query]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-full max-w-sm" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <InlineAlert onRetry={() => refetch()} title="Couldn’t load agents">
        {error}
      </InlineAlert>
    );
  }

  if (agents.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="No agents yet"
        description="Create your first agent in this workspace."
        action={
          <Link
            href="/agents/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "rounded-full"
            )}
          >
            <Plus data-icon="inline-start" />
            New agent
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="h-9 max-w-sm bg-card">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            aria-label="Search agents"
          />
        </InputGroup>

        <ToggleGroup
          value={[view]}
          onValueChange={(next) => {
            if (next?.[0]) setView(next[0]);
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="View mode"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No agents match “{query.trim()}”.
        </p>
      ) : (
        <div
          className={cn(
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-3"
          )}
        >
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              layout={view}
              onDeleted={(id) =>
                queryClient.setQueryData(queryKeys.agents.all, (current = []) =>
                  current.filter((item) => item.id !== id)
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
