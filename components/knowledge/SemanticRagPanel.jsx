"use client";

import { useEffect, useState } from "react";
import { BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { updateAgent } from "@/lib/api/agents";
import { FormSection } from "@/components/customization/CustomizationFields";

/** Level 3 · L1 — optional semantic RAG (pgvector + hybrid retrieve). Off by default. */
export function SemanticRagPanel({ agentId, semanticRagEnabled = false, onSaved }) {
  const [enabled, setEnabled] = useState(Boolean(semanticRagEnabled));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(semanticRagEnabled));
  }, [semanticRagEnabled]);

  async function handleToggle(next) {
    if (!agentId || busy) return;
    setBusy(true);
    const prev = enabled;
    setEnabled(next);
    try {
      const updated = await updateAgent(agentId, { semanticRagEnabled: next });
      const value = Boolean(updated.semanticRagEnabled);
      setEnabled(value);
      onSaved?.(value);
      toast.success(
        value
          ? "Semantic search on — new knowledge will be embedded for meaning-based retrieve"
          : "Semantic search off — answers use keyword knowledge only"
      );
    } catch (err) {
      setEnabled(prev);
      toast.error(err.message || "Unable to update semantic search");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title="Semantic search">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BrainCircuit className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Meaning-based knowledge retrieve</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When on, Aide embeds knowledge chunks and blends vector matches with keyword search.
              Chat still stays within the knowledge budget; embeddings never grant permissions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {busy ? <Spinner className="size-3.5" /> : null}
          <Switch
            checked={enabled}
            disabled={busy || !agentId}
            onCheckedChange={(checked) => handleToggle(checked === true)}
            aria-label="Enable semantic knowledge search"
          />
        </div>
      </div>
    </FormSection>
  );
}
