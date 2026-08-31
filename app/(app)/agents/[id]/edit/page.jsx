"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAgent } from "@/lib/api/agents";
import { AgentForm } from "@/components/agents/AgentForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgentCrumb } from "@/hooks/use-agent-crumb";

export default function EditAgentPage() {
  const params = useParams();
  const id = params?.id;
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useAgentCrumb(agent?.name);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getAgent(id);
        if (!cancelled) setAgent(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load agent");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="aide-page">
        <Skeleton className="h-8 w-48 bg-[var(--color-border)]" />
        <Skeleton className="mt-6 h-80 w-full max-w-2xl rounded-xl bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="aide-page">
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
    <main className="aide-page">
      <header>
        <Link
          href={`/agents/${agent.id}`}
          className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
        >
          ← {agent.name}
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-text)] sm:text-2xl">
          Edit agent
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Update settings for {agent.name}
        </p>
      </header>
      <div className="mt-6 max-w-3xl">
        <AgentForm mode="edit" initialAgent={agent} />
      </div>
    </main>
  );
}
