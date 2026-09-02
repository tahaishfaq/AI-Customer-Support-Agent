"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { updateAgent } from "@/lib/api/agents";
import { FormSection } from "@/components/customization/CustomizationFields";

/**
 * Knowledge → allow the agent to use general web / public knowledge when
 * uploaded docs are not enough (prompt policy; default off).
 */
export function WebSearchPanel({
  agentId,
  webSearchEnabled = false,
  onSaved,
}) {
  const [enabled, setEnabled] = useState(Boolean(webSearchEnabled));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(webSearchEnabled));
  }, [webSearchEnabled]);

  async function handleToggle(next) {
    if (!agentId || busy) return;
    setBusy(true);
    const prev = enabled;
    setEnabled(next);
    try {
      const updated = await updateAgent(agentId, { webSearchEnabled: next });
      const value = Boolean(updated.webSearchEnabled);
      setEnabled(value);
      onSaved?.(value);
      toast.success(
        value
          ? "Web search on — agent may use general knowledge when docs fall short"
          : "Web search off — answers stay on your knowledge base"
      );
    } catch (err) {
      setEnabled(prev);
      toast.error(err.message || "Unable to update web search");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title="Web search">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Globe className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Allow web / general knowledge
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              When off, the agent only uses your uploaded knowledge (FAQ, PDF,
              crawled site). When on, it may also use careful general public
              knowledge if your docs don’t cover the question — and will say so.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {busy ? <Spinner className="size-3.5" /> : null}
          <Switch
            checked={enabled}
            disabled={busy || !agentId}
            onCheckedChange={(checked) => handleToggle(checked === true)}
            aria-label="Allow web search"
          />
        </div>
      </div>
    </FormSection>
  );
}
