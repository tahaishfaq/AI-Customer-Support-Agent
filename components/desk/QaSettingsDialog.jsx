"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { getQaSettings, saveQaSettings } from "@/lib/api/qa-settings";
import { estimateQaMonthlyCost } from "@/lib/services/ai/qa-judge";
import { queryKeys } from "@/lib/query/keys";

/** Level 3 · L2 — workspace Auto-QA sampling (Owner/Admin). */
export function QaSettingsDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.workspace.qaSettings,
    queryFn: getQaSettings,
    enabled: open,
    staleTime: 30_000,
  });
  const settings = draft || query.data?.settings;
  const cost = settings ? estimateQaMonthlyCost(settings) : null;

  function update(partial) {
    setDraft({ ...(draft || query.data?.settings), ...partial });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await saveQaSettings(settings);
      queryClient.setQueryData(queryKeys.workspace.qaSettings, saved);
      setDraft(null);
      setOpen(false);
      toast.success("Answer quality settings saved");
    } catch (err) {
      toast.error(err.message || "Could not save QA settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(null);
      }}
    >
      <Button type="button" variant="ghost" size="icon" aria-label="Answer quality settings" onClick={() => setOpen(true)}>
        <ShieldCheck className="size-4" aria-hidden />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Answer quality (Auto-QA)</DialogTitle>
          <DialogDescription>
            Sample settled chats for CX score and ungrounded claims. Off until you enable it.
          </DialogDescription>
        </DialogHeader>

        {!settings ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {query.error ? query.error.message : "Loading…"}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Enable Auto-QA</p>
                <p className="text-xs text-muted-foreground">Scores run in the background after chats settle.</p>
              </div>
              <Switch
                checked={Boolean(settings.enabled)}
                onCheckedChange={(enabled) => update({ enabled })}
              />
            </div>
            <label className="text-sm">
              Sample rate (0–1)
              <Input
                className="mt-1 h-9"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settings.sampleRate ?? 0.2}
                onChange={(event) => update({ sampleRate: Number(event.target.value) })}
              />
            </label>
            <label className="text-sm">
              Monthly cap
              <Input
                className="mt-1 h-9"
                type="number"
                min={0}
                max={10000}
                value={settings.monthlyCap ?? 500}
                onChange={(event) => update({ monthlyCap: Number(event.target.value) })}
              />
            </label>
            {cost ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Estimated cost at these settings: ~{cost.estimatedScores} scores / month ≈ $
                {cost.estimatedUsd.toFixed(3)} (about ${cost.usdPerScore} per score). Cap never
                exceeds {cost.monthlyCap}.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!settings || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
