"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
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
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query/keys";

async function getPrivacy() {
  return apiFetch("/api/workspace/privacy");
}

async function savePrivacy(body) {
  return apiFetch("/api/workspace/privacy", {
    method: "PUT",
    body: JSON.stringify(body || {}),
  });
}

/** Level 3 · L6 — PII redaction + retention (Owner/Admin). */
export function PrivacySettingsDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.workspace.privacy,
    queryFn: getPrivacy,
    enabled: open,
    staleTime: 30_000,
  });
  const settings = draft || query.data?.settings;

  function update(partial) {
    setDraft({ ...(draft || query.data?.settings), ...partial });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await savePrivacy({
        ...settings,
        confirmLowerRetention: confirm || undefined,
      });
      queryClient.setQueryData(queryKeys.workspace.privacy, saved);
      setDraft(null);
      setConfirm("");
      setOpen(false);
      toast.success("Privacy settings saved");
    } catch (err) {
      toast.error(err.message || "Could not save privacy settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDraft(null);
          setConfirm("");
        }
      }}
    >
      <Button type="button" variant="ghost" size="icon" aria-label="Privacy settings" onClick={() => setOpen(true)}>
        <Lock className="size-4" aria-hidden />
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Privacy & retention</DialogTitle>
          <DialogDescription>
            Redact PII in stored transcripts, and optionally delete settled chats after N days.
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
                <p className="text-sm font-medium">Redact PII in stored messages</p>
                <p className="text-xs text-muted-foreground">
                  Emails, phones, cards, CNIC, IBAN. The model still sees the original for the current turn.
                </p>
              </div>
              <Switch
                checked={Boolean(settings.redactPii)}
                onCheckedChange={(redactPii) => update({ redactPii })}
              />
            </div>
            <label className="text-sm">
              Retention days (blank = keep forever, min 30)
              <Input
                className="mt-1 h-9"
                type="number"
                min={30}
                max={3650}
                value={settings.retentionDays ?? ""}
                onChange={(event) =>
                  update({
                    retentionDays: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />
            </label>
            <p className="text-xs text-muted-foreground">
              About {query.data?.previewCount ?? 0} chats would be eligible under the current retention.
            </p>
            <label className="text-sm">
              Confirm shorter retention (type LOWER RETENTION)
              <Input
                className="mt-1 h-9"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
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
