"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { listAgents } from "@/lib/api/agents";
import { AgentCard } from "@/components/agents/AgentCard";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AgentList() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-52 w-full rounded-2xl bg-[var(--color-border)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-6 py-8 text-center">
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
      <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Bot className="size-7" />
        </span>
        <h2 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">
          No agents yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Create your first AI support agent with a name, system prompt, and
          welcome message.
        </p>
        <Link
          href="/agents/new"
          className={cn(buttonVariants({ size: "lg" }), "mt-7 inline-flex")}
        >
          Create your first agent
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {agents.map((agent, index) => (
        <div
          key={agent.id}
          className={cn(
            "h-full",
            index === 0 && "animate-fade-up",
            index === 1 && "animate-fade-up-delay-1",
            index >= 2 && "animate-fade-up-delay-2"
          )}
        >
          <AgentCard agent={agent} />
        </div>
      ))}
    </div>
  );
}
