"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDeskSettings, saveDeskSettings } from "@/lib/api/desk";
import { queryKeys } from "@/lib/query/keys";

const MODES = [
  { id: "owner", label: "Agent owner", hint: "Every handoff goes to the agent's owner (default)." },
  { id: "least_busy", label: "Least busy teammate", hint: "Goes to the teammate below with the fewest waiting chats." },
  { id: "manual", label: "Unassigned", hint: "Lands unassigned; a teammate claims it from the inbox." },
];
const SLA_OPTIONS = [null, 5, 15, 30, 60, 120, 240, 480, 1440];
const slaLabel = (minutes) =>
  minutes == null ? "Off" : minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;

/** Level 2 · M3 — team routing + first-reply SLA (Owner/Admin). */
export function DeskSettingsDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({ queryKey: queryKeys.desk.settings, queryFn: getDeskSettings, enabled: open, staleTime: 30_000 });
  const settings = draft || query.data?.settings;
  const teammates = query.data?.teammates || [];

  function update(partial) {
    setDraft({ ...(draft || query.data?.settings), ...partial });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await saveDeskSettings(settings);
      queryClient.setQueryData(queryKeys.desk.settings, saved);
      void queryClient.invalidateQueries({ queryKey: ["desk", "inbox"] });
      setDraft(null);
      setOpen(false);
      toast.success("Desk routing saved");
    } catch (err) {
      toast.error(err.message || "Could not save desk routing");
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
      <Button type="button" variant="ghost" size="icon" aria-label="Desk routing and SLA" onClick={() => setOpen(true)}>
        <Settings2 className="size-4" aria-hidden />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Routing & response time</DialogTitle>
          <DialogDescription>Who gets new handoffs, and how fast a teammate should first reply.</DialogDescription>
        </DialogHeader>

        {!settings ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{query.error ? query.error.message : "Loading…"}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold text-foreground">Assign new handoffs to</legend>
              {MODES.map((mode) => (
                <label key={mode.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5 text-sm">
                  <input
                    type="radio"
                    name="desk-assignment"
                    value={mode.id}
                    className="mt-1"
                    checked={settings.assignment === mode.id}
                    onChange={() => update({ assignment: mode.id })}
                  />
                  <span>
                    <span className="font-medium">{mode.label}</span>
                    <span className="block text-xs text-muted-foreground">{mode.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {settings.assignment === "least_busy" ? (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-xs font-semibold text-foreground">Teammates in the rotation (none ticked = everyone)</legend>
                {teammates.map((mate) => (
                  <label key={mate.userId} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={settings.pool.includes(mate.userId)}
                      onCheckedChange={(checked) =>
                        update({
                          pool: checked
                            ? [...settings.pool, mate.userId]
                            : settings.pool.filter((id) => id !== mate.userId),
                        })
                      }
                    />
                    {mate.name} <span className="text-xs text-muted-foreground">({mate.role.toLowerCase()})</span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground">
              First reply within
              <select
                className="h-9 rounded-lg border border-border bg-card px-2 text-sm font-normal"
                value={settings.slaFirstReplyMinutes ?? ""}
                onChange={(event) => update({ slaFirstReplyMinutes: event.target.value ? Number(event.target.value) : null })}
              >
                {SLA_OPTIONS.map((minutes) => (
                  <option key={minutes ?? "off"} value={minutes ?? ""}>
                    {slaLabel(minutes)}
                  </option>
                ))}
              </select>
              <span className="font-normal text-muted-foreground">Chats past this time show as Overdue.</span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" disabled={!settings || saving || !draft} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
