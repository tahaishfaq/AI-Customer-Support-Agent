"use client";

import { useMemo, useState } from "react";
import { FileJson } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  FieldBlock,
  FormSection,
} from "@/components/customization/CustomizationFields";
import { importAgentOpenApiActions } from "@/lib/api/actions";

/**
 * Paste OpenAPI 3.x JSON → disabled draft AgentActions (publish + policy review).
 */
export function OpenApiImportPanel({ agentId, onImported }) {
  const [raw, setRaw] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const canRun = useMemo(
    () => Boolean(agentId && String(raw || "").trim()),
    [agentId, raw]
  );

  async function runImport({ dryRun }) {
    if (!canRun) return;
    setBusy(true);
    try {
      let document = String(raw).trim();
      try {
        document = JSON.parse(document);
      } catch {
        // Server accepts JSON string; leave as string if not parseable here.
      }
      const result = await importAgentOpenApiActions(agentId, {
        document,
        baseUrl: baseUrl.trim() || undefined,
        dryRun,
      });
      setPreview(result);
      if (dryRun) {
        toast.success(
          `Preview: ${result.draftCount ?? result.drafts?.length ?? 0} draft(s), ${
            result.skippedCount ?? result.skipped?.length ?? 0
          } skipped`
        );
      } else {
        toast.success(
          `Imported ${result.created?.length || 0} disabled draft tool(s) — review access class, then enable + publish`
        );
        await onImported?.();
      }
    } catch (err) {
      toast.error(err.message || "OpenAPI import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title="Import OpenAPI">
      <FieldBlock
        label="OpenAPI 3.x JSON"
        hint="Creates disabled drafts only. GET/POST operations map to tools. Review policy before enable/publish."
      >
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='{ "openapi": "3.0.3", "paths": { ... } }'
          className="min-h-[140px] font-mono text-[11px]"
          disabled={busy}
        />
      </FieldBlock>
      <FieldBlock
        label="Base URL override (optional)"
        hint="Required when the document has no absolute servers[0].url."
      >
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
          disabled={busy}
          className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </FieldBlock>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canRun || busy}
          onClick={() => runImport({ dryRun: true })}
        >
          {busy ? <Spinner data-icon="inline-start" /> : <FileJson data-icon="inline-start" />}
          Preview drafts
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canRun || busy}
          onClick={() => runImport({ dryRun: false })}
        >
          {busy ? <Spinner data-icon="inline-start" /> : null}
          Import disabled drafts
        </Button>
      </div>
      {preview ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p>
            {preview.title ? `${preview.title} · ` : ""}
            needsPublish={String(preview.needsPublish)} · needsPolicyReview=
            {String(preview.needsPolicyReview)}
          </p>
          <p className="mt-1">
            Drafts: {preview.draftCount ?? preview.drafts?.length ?? 0}
            {" · "}
            Created: {preview.created?.length ?? 0}
            {" · "}
            Skipped: {preview.skippedCount ?? preview.skipped?.length ?? 0}
          </p>
          {Array.isArray(preview.drafts) && preview.drafts.length ? (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-[11px]">
              {preview.drafts.slice(0, 20).map((d) => (
                <li key={d.name}>
                  {d.method} {d.name} · {d.accessClass} · enabled=
                  {String(d.enabled)}
                </li>
              ))}
            </ul>
          ) : null}
          {Array.isArray(preview.created) && preview.created.length ? (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-[11px]">
              {preview.created.slice(0, 20).map((d) => (
                <li key={d.id || d.name}>
                  {d.name} · draft · {d.accessClass}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </FormSection>
  );
}
