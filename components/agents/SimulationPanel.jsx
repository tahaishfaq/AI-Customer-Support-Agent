"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query/keys";

async function listRuns(agentId) {
  return apiFetch(`/api/agents/${agentId}/simulations`);
}

async function startRun(agentId, body) {
  return apiFetch(`/api/agents/${agentId}/simulations`, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}

/** Level 3 · L8 — dry-run simulation (never bills). */
export function SimulationPanel({ agentId }) {
  const queryClient = useQueryClient();
  const [questionsText, setQuestionsText] = useState("");
  const [persona, setPersona] = useState("customer");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.agents.simulations(agentId),
    queryFn: () => listRuns(agentId),
    enabled: Boolean(agentId),
    refetchInterval: (q) =>
      (q.state.data?.runs || []).some((run) => run.status === "RUNNING" || run.status === "PENDING")
        ? 3000
        : false,
  });

  async function start() {
    setBusy(true);
    try {
      await startRun(agentId, { questionsText, persona });
      setQuestionsText("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.simulations(agentId) });
      toast.success("Simulation started");
    } catch (err) {
      toast.error(err.message || "Could not start simulation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="aide-card flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="sim-heading">
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <FlaskConical className="size-4" />
        </span>
        <div>
          <h2 id="sim-heading" className="text-sm font-semibold text-foreground">
            Simulation
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dry-run questions against this agent. WRITE tools are not executed. Results never count
            toward billing or analytics.
          </p>
        </div>
      </div>
      <Input
        className="h-9"
        value={persona}
        onChange={(event) => setPersona(event.target.value)}
        placeholder="Persona"
      />
      <Textarea
        className="min-h-28"
        value={questionsText}
        onChange={(event) => setQuestionsText(event.target.value)}
        placeholder={"One question per line\nWhere is my order?\nHow do I reset my password?"}
      />
      <Button type="button" size="sm" disabled={busy || !questionsText.trim()} onClick={start}>
        {busy ? "Starting…" : "Run simulation"}
      </Button>
      <ul className="divide-y divide-border text-sm">
        {(query.data?.runs || []).slice(0, 8).map((run) => (
          <li key={run.id} className="flex items-center justify-between gap-2 py-2">
            <span>
              {run.status} · {run.completedCount}/{run.questionCount}
              {run.avgCxScore != null ? ` · CX ${Math.round(run.avgCxScore)}` : ""}
            </span>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>
              {new Date(run.createdAt).toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
