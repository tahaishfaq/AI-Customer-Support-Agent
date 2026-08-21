"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdminSettings, updateAdminSettings } from "@/lib/api/admin";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Toggle({ on, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        on ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
          on ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}

function Row({ title, hint, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 sm:max-w-md">
        <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
        <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AdminSafety() {
  const [settings, setSettings] = useState(null);
  const [draftCaps, setDraftCaps] = useState({
    maxWorkspacesPerUser: 20,
    maxAgentsPerWorkspace: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminSettings();
      setSettings(data);
      setDraftCaps({
        maxWorkspacesPerUser: data.maxWorkspacesPerUser,
        maxAgentsPerWorkspace: data.maxAgentsPerWorkspace,
      });
    } catch (err) {
      setError(err.message || "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(partial, key) {
    setBusy(key);
    try {
      const next = await updateAdminSettings(partial);
      setSettings(next);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err.message || "Unable to save");
    } finally {
      setBusy("");
    }
  }

  async function saveCaps() {
    await patch(
      {
        maxWorkspacesPerUser: draftCaps.maxWorkspacesPerUser,
        maxAgentsPerWorkspace: draftCaps.maxAgentsPerWorkspace,
      },
      "caps"
    );
  }

  if (loading) {
    return (
      <main className="hapy-page">
        <Skeleton className="h-10 w-48 bg-[var(--color-border)]" />
        <Skeleton className="mt-6 h-48 w-full bg-[var(--color-border)]" />
      </main>
    );
  }

  return (
    <main className="hapy-page">
      <PageHeader
        title="Safety"
        description="Signups, maintenance, public embed kill, and creation caps."
      />

      {error ? (
        <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        <Row
          title="Allow new signups"
          hint="When off, email register and first-time Google sign-in are blocked."
        >
          <Toggle
            on={Boolean(settings?.signupsEnabled)}
            disabled={busy === "signups"}
            onChange={(on) => patch({ signupsEnabled: on }, "signups")}
          />
        </Row>
        <Row
          title="Maintenance mode"
          hint="Customers cannot use the product console. Admin stays available."
        >
          <Toggle
            on={Boolean(settings?.maintenanceMode)}
            disabled={busy === "maintenance"}
            onChange={(on) => patch({ maintenanceMode: on }, "maintenance")}
          />
        </Row>
        <Row
          title="Kill all public embeds"
          hint="Every website widget and /w/{key} chat returns unavailable."
        >
          <Toggle
            on={Boolean(settings?.globalEmbedKill)}
            disabled={busy === "embed"}
            onChange={(on) => patch({ globalEmbedKill: on }, "embed")}
          />
        </Row>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        <div className="px-4 py-4">
          <p className="text-sm font-medium text-[var(--color-text)]">
            Soft caps
          </p>
          <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
            0 means unlimited. Existing items are not deleted if you lower a cap.
          </p>
        </div>
        <div className="grid gap-4 border-t border-[var(--color-border)] px-4 py-4 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[var(--color-text-secondary)]">
            Max workspaces per user
            <input
              type="number"
              min={0}
              max={500}
              value={draftCaps.maxWorkspacesPerUser}
              onChange={(e) =>
                setDraftCaps((prev) => ({
                  ...prev,
                  maxWorkspacesPerUser: e.target.value,
                }))
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--color-border)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="block text-[13px] font-medium text-[var(--color-text-secondary)]">
            Max agents per workspace
            <input
              type="number"
              min={0}
              max={500}
              value={draftCaps.maxAgentsPerWorkspace}
              onChange={(e) =>
                setDraftCaps((prev) => ({
                  ...prev,
                  maxAgentsPerWorkspace: e.target.value,
                }))
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--color-border)] px-3 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </label>
        </div>
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <Button
            type="button"
            size="sm"
            disabled={busy === "caps"}
            onClick={saveCaps}
          >
            {busy === "caps" ? "Saving…" : "Save caps"}
          </Button>
        </div>
      </section>
    </main>
  );
}
