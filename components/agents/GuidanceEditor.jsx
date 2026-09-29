"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateAgent } from "@/lib/api/agents";
import { MAX_GUIDANCE_RULES, guidanceSchema } from "@/lib/validations/guidance";

function newRuleId() {
  return `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Level 2 · M5 — owner rules: "When the customer …, do …". Saved on their own (PUT { guidance }),
 * so this never touches the agent's other settings.
 */
export function GuidanceEditor({ agent, onSaved }) {
  /** Last saved rules: the "unsaved changes" baseline. */
  const [saved, setSaved] = useState(() => (Array.isArray(agent?.guidance) ? agent.guidance : []));
  const [rules, setRules] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);

  function patch(id, partial) {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...partial } : rule)));
  }

  async function save() {
    const parsed = guidanceSchema.safeParse(rules);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check the rules");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateAgent(agent.id, { guidance: parsed.data });
      const stored = Array.isArray(updated?.guidance) ? updated.guidance : parsed.data;
      setRules(stored);
      setSaved(stored);
      onSaved?.(updated);
      toast.success("Guidance saved");
    } catch (err) {
      setError(err.message || "Could not save guidance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="aide-card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="guidance-heading">
      <div className="flex flex-col gap-1">
        <h2 id="guidance-heading" className="text-base font-semibold text-foreground">
          Guidance
        </h2>
        <p className="text-xs text-muted-foreground">
          Rules for specific situations, e.g. “When a customer asks for a refund, ask for the order number first.”
          Rules shape answers only — they cannot skip confirmations or unlock tools. Try them in Test Studio after saving.
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No rules yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rules.map((rule, index) => (
            <li key={rule.id} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={rule.title}
                  maxLength={80}
                  onChange={(event) => patch(rule.id, { title: event.target.value })}
                  placeholder={`Rule ${index + 1} title`}
                  aria-label={`Rule ${index + 1} title`}
                  className="h-9"
                />
                <Switch
                  checked={rule.enabled !== false}
                  onCheckedChange={(enabled) => patch(rule.id, { enabled })}
                  aria-label={`Rule ${index + 1} enabled`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))}
                  aria-label={`Delete rule ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
              <label className="mt-2 block text-[11px] font-medium text-muted-foreground">
                When (leave empty to always apply)
                <Textarea
                  value={rule.when || ""}
                  maxLength={300}
                  onChange={(event) => patch(rule.id, { when: event.target.value })}
                  placeholder="the customer asks for a refund"
                  className="mt-1 min-h-[52px] resize-y"
                />
              </label>
              <label className="mt-2 block text-[11px] font-medium text-muted-foreground">
                Do this
                <Textarea
                  value={rule.then || ""}
                  maxLength={800}
                  onChange={(event) => patch(rule.id, { then: event.target.value })}
                  placeholder="Ask for the order number first, then explain the 14-day refund policy."
                  className="mt-1 min-h-[64px] resize-y"
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rules.length >= MAX_GUIDANCE_RULES}
          onClick={() => setRules((current) => [...current, { id: newRuleId(), title: "", when: "", then: "", enabled: true }])}
        >
          <Plus className="size-4" aria-hidden /> Add rule
        </Button>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save guidance"}
        </Button>
      </div>
    </section>
  );
}
