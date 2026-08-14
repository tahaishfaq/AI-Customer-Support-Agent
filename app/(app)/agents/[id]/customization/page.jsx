"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAgent } from "@/lib/api/agents";
import { AgentHero } from "@/components/agents/AgentHero";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { CustomizationStudio } from "@/components/customization/CustomizationStudio";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentCustomizationPage() {
  const params = useParams();
  const id = params?.id;
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

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
        if (!cancelled) {
          setError(err.message || "Unable to load agent");
        }
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
      <main className="hapy-page">
        <Skeleton className="h-40 w-full rounded-xl bg-[var(--color-border)]" />
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
      <AgentHero agent={agent} onDelete={() => setDeleteOpen(true)} />
      <div className="mt-6">
        <CustomizationStudio agent={agent} />
      </div>
      <DeleteAgentDialog
        agent={agent}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </main>
  );
}
