"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { updateAgent } from "@/lib/api/agents";
import { FormSection } from "@/components/customization/CustomizationFields";

/** Level 3 · L7 — optional meaning-based tool shortlist. Off by default. */
export function SemanticToolShortlistPanel({
  agentId,
  semanticToolShortlist = false,
  onSaved,
}) {
  const [enabled, setEnabled] = useState(Boolean(semanticToolShortlist));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(semanticToolShortlist));
  }, [semanticToolShortlist]);

  async function handleToggle(next) {
    if (!agentId || busy) return;
    setBusy(true);
    const prev = enabled;
    setEnabled(next);
    try {
      const updated = await updateAgent(agentId, { semanticToolShortlist: next });
      const value = Boolean(updated.semanticToolShortlist);
      setEnabled(value);
      onSaved?.(value);
      toast.success(
        value
          ? "Meaning-based tool shortlist on — when many tools are enabled, Aide ranks by meaning"
          : "Meaning-based tool shortlist off — keyword shortlist only"
      );
    } catch (err) {
      setEnabled(prev);
      toast.error(err.message || "Unable to update tool shortlist");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title="Tool shortlist">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Wrench className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Meaning-based tool ranking</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When on, Aide embeds tool names/descriptions and blends vector matches with keyword
              shortlisting. Policy, confirmation, and routing stay unchanged.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {busy ? <Spinner className="size-3.5" /> : null}
          <Switch
            checked={enabled}
            disabled={busy || !agentId}
            onCheckedChange={(checked) => handleToggle(checked === true)}
            aria-label="Enable meaning-based tool shortlist"
          />
        </div>
      </div>
    </FormSection>
  );
}
