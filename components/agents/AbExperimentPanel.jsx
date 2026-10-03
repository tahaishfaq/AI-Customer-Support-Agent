"use client";

import { useEffect, useMemo, useState } from "react";
import { Split } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updateAgent, listAgentRevisions } from "@/lib/api/agents";
import { apiFetch } from "@/lib/api-client";
import { normalizeAbTest, abReadyToStop } from "@/lib/ab/bucket";

/**
 * Level 3 · L8 — configure prompt A/B. Never auto-promotes; restore winner in Version history.
 */
export function AbExperimentPanel({ agent, onSaved }) {
  const config = useMemo(
    () => normalizeAbTest(agent?.abTest),
    [agent?.abTest]
  );
  const [enabled, setEnabled] = useState(config.enabled);
  const [revisionA, setRevisionA] = useState(
    config.revisionA != null ? String(config.revisionA) : ""
  );
  const [revisionB, setRevisionB] = useState(
    config.revisionB != null ? String(config.revisionB) : ""
  );
  const [minSample, setMinSample] = useState(String(config.minSample || 100));
  const [revisions, setRevisions] = useState([]);
  const [stats, setStats] = useState({ samplesA: 0, samplesB: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEnabled(config.enabled);
    setRevisionA(config.revisionA != null ? String(config.revisionA) : "");
    setRevisionB(config.revisionB != null ? String(config.revisionB) : "");
    setMinSample(String(config.minSample || 100));
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    listAgentRevisions(agent.id)
      .then((data) => {
        if (!cancelled) setRevisions(data?.revisions || data || []);
      })
      .catch(() => {
        if (!cancelled) setRevisions([]);
      });
    apiFetch(`/api/agents/${agent.id}/ab-stats`)
      .then((data) => {
        if (!cancelled) {
          setStats({
            samplesA: Number(data?.samplesA) || 0,
            samplesB: Number(data?.samplesB) || 0,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  const ready = abReadyToStop({
    samplesA: stats.samplesA,
    samplesB: stats.samplesB,
    minSample: Number(minSample) || 100,
  });

  async function save() {
    const a = Number.parseInt(revisionA, 10);
    const b = Number.parseInt(revisionB, 10);
    const min = Math.max(10, Number.parseInt(minSample, 10) || 100);
    if (enabled && (!Number.isFinite(a) || !Number.isFinite(b) || a === b)) {
      setError("Pick two different revision versions when enabled");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const abTest = enabled
        ? {
            enabled: true,
            revisionA: a,
            revisionB: b,
            minSample: min,
            stopRule: "min_sample",
          }
        : { enabled: false, revisionA: null, revisionB: null, minSample: min };
      const updated = await updateAgent(agent.id, { abTest });
      onSaved?.(updated);
      toast.success(enabled ? "A/B experiment saved" : "A/B experiment off");
    } catch (err) {
      setError(err.message || "Could not save A/B settings");
    } finally {
      setSaving(false);
    }
  }

  const versionOptions = (Array.isArray(revisions) ? revisions : [])
    .map((r) => r.version)
    .filter((v) => Number.isFinite(Number(v)));

  return (
    <section
      className="aide-card flex flex-col gap-4 p-4 sm:p-5"
      aria-labelledby="ab-heading"
    >
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Split className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ab-heading" className="text-sm font-semibold text-foreground">
            Prompt A/B experiment
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Split embed visitors across two saved versions. Aide never
            auto-promotes — restore the winner in Version history when samples
            are enough.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor="ab-enabled" className="text-xs">
            Enabled
          </Label>
          <Switch
            id="ab-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={saving}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ab-rev-a">Version A</Label>
          <Input
            id="ab-rev-a"
            list={`ab-versions-${agent.id}`}
            value={revisionA}
            onChange={(e) => setRevisionA(e.target.value)}
            placeholder="e.g. 3"
            disabled={saving || !enabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ab-rev-b">Version B</Label>
          <Input
            id="ab-rev-b"
            list={`ab-versions-${agent.id}`}
            value={revisionB}
            onChange={(e) => setRevisionB(e.target.value)}
            placeholder="e.g. 5"
            disabled={saving || !enabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ab-min">Min sample / bucket</Label>
          <Input
            id="ab-min"
            type="number"
            min={10}
            value={minSample}
            onChange={(e) => setMinSample(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>
      <datalist id={`ab-versions-${agent.id}`}>
        {versionOptions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        Samples — A: <strong className="text-foreground">{stats.samplesA}</strong>
        {" · "}
        B: <strong className="text-foreground">{stats.samplesB}</strong>
        {ready ? (
          <span className="mt-1 block font-medium text-emerald-700 dark:text-emerald-400">
            Enough samples to stop. Compare results, then restore the winner
            manually in Version history.
          </span>
        ) : (
          <span className="mt-1 block">
            Need at least {Math.max(10, Number(minSample) || 100)} embed
            conversations per bucket before stopping.
          </span>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save A/B settings"}
        </Button>
      </div>
    </section>
  );
}
