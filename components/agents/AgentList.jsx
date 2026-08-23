"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, Search } from "lucide-react";
import { listAgents } from "@/lib/api/agents";
import { AgentCard } from "@/components/agents/AgentCard";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AgentList() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listAgents();
      setAgents(data);
    } catch (err) {
      setError(err.message || "Unable to load agents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) =>
      (agent.name || "").toLowerCase().includes(q)
    );
  }, [agents, query]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-56 w-full rounded-xl bg-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-6 py-8 text-center">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 text-sm font-medium text-[var(--color-primary)] underline"
        >
          Try again
        </button>
      </div>
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
            className={cn(buttonVariants({ size: "sm" }), "inline-flex")}
          >
            New agent
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agents…"
          aria-label="Search agents"
          className="h-9 border-[var(--color-border)] bg-[var(--color-surface)] pl-9 shadow-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--color-muted)]">
          No agents match “{query.trim()}”.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDeleted={(id) =>
                setAgents((prev) => prev.filter((item) => item.id !== id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
