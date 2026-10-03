"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAgent } from "@/lib/api/agents";
import { AgentForm } from "@/components/agents/AgentForm";
import { GuidanceEditor } from "@/components/agents/GuidanceEditor";
import { ProceduresEditor } from "@/components/agents/ProceduresEditor";
import { SimulationPanel } from "@/components/agents/SimulationPanel";
import { EmailChannelPanel } from "@/components/agents/EmailChannelPanel";
import { AbExperimentPanel } from "@/components/agents/AbExperimentPanel";
import { VersionHistory } from "@/components/agents/VersionHistory";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import {
  AppRouteSkeleton,
  LoadingSurface,
} from "@/components/ui/loading-surface";
import { useAgentCrumb } from "@/hooks/use-agent-crumb";

export default function EditAgentPage() {
  const params = useParams();
  const id = params?.id;
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Bumped after a restore so the forms reload with the restored values. */
  const [formsKey, setFormsKey] = useState(0);
  const queryClient = useQueryClient();
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
        <LoadingSurface label="Loading agent…">
          <AppRouteSkeleton />
        </LoadingSurface>
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
        <AgentForm key={`form-${formsKey}`} mode="edit" initialAgent={agent} />
      </div>
      <div className="mt-6 max-w-3xl">
        <GuidanceEditor
          key={`guidance-${formsKey}`}
          agent={agent}
          onSaved={(updated) => {
            setAgent((current) => ({ ...current, ...updated }));
            void queryClient.invalidateQueries({ queryKey: queryKeys.agents.revisions(agent.id) });
          }}
        />
      </div>
      <div className="mt-6 max-w-3xl">
        <ProceduresEditor
          key={`procedures-${formsKey}`}
          agent={agent}
          onSaved={(updated) => {
            setAgent((current) => ({ ...current, ...updated }));
            void queryClient.invalidateQueries({ queryKey: queryKeys.agents.revisions(agent.id) });
          }}
        />
      </div>
      <div className="mt-6 max-w-3xl">
        <EmailChannelPanel
          agent={agent}
          onSaved={(updated) => {
            setAgent((current) => ({ ...current, ...updated }));
          }}
        />
      </div>
      <div className="mt-6 max-w-3xl">
        <VersionHistory
          agent={agent}
          onRestored={(restored) => {
            setAgent((current) => ({ ...current, ...restored }));
            setFormsKey((value) => value + 1);
          }}
        />
      </div>
      <div className="mt-6 max-w-3xl">
        <AbExperimentPanel
          agent={agent}
          onSaved={(updated) => {
            setAgent((current) => ({ ...current, ...updated }));
          }}
        />
      </div>
      <div className="mt-6 max-w-3xl">
        <SimulationPanel agentId={agent.id} />
      </div>
    </main>
  );
}
