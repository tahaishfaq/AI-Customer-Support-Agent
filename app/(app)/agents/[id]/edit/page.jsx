"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAgent } from "@/lib/api/agents";
import { AgentForm } from "@/components/agents/AgentForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditAgentPage() {
  const params = useParams();
  const id = params?.id;
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Skeleton className="mx-auto h-8 w-48 bg-[var(--color-border)]" />
        <Skeleton className="mx-auto mt-6 h-80 w-full max-w-2xl rounded-3xl bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
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
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="animate-fade-up mx-auto max-w-2xl">
        <Link
          href={`/agents/${agent.id}`}
          className="text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          ← Back to agent
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
          Edit Agent
        </h1>
        <p className="mt-2 mb-8 text-[var(--color-text-secondary)]">
          Update settings for {agent.name}
        </p>
      </div>
      <div className="animate-fade-up-delay-1">
        <AgentForm mode="edit" initialAgent={agent} />
      </div>
    </main>
  );
}
