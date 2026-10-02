"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Webhook } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { formatRelative } from "@/components/conversations/format";
import {
  createWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  listWebhooks,
  rotateWebhookSecret,
  sendTestWebhook,
  updateWebhook,
} from "@/lib/api/developer";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_TYPES } from "@/lib/webhooks/events";
import { SecretOnceDialog } from "@/components/developer/SecretOnceDialog";

const HOOKS_QUERY = ["developer", "webhooks"];
const STATUS_STYLE = {
  SUCCEEDED: "text-emerald-700 dark:text-emerald-400",
  FAILED: "text-amber-700 dark:text-amber-400",
  DEAD: "text-destructive",
  PENDING: "text-muted-foreground",
};

function EventPicker({ value, onChange, idPrefix }) {
  return (
    <fieldset className="grid gap-1.5 sm:grid-cols-2">
      <legend className="mb-1 text-[11px] font-medium text-muted-foreground">Events</legend>
      {WEBHOOK_EVENT_TYPES.map((type) => (
        <label key={type} htmlFor={`${idPrefix}-${type}`} className="flex items-start gap-2 text-xs text-foreground">
          <input
            id={`${idPrefix}-${type}`}
            type="checkbox"
            className="mt-0.5"
            checked={value.includes(type)}
            onChange={(event) =>
              onChange(event.target.checked ? [...value, type] : value.filter((item) => item !== type))
            }
          />
          <span>
            {WEBHOOK_EVENTS[type]}
            <span className="block font-mono text-[10px] text-muted-foreground">{type}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function Deliveries({ webhookId }) {
  const query = useQuery({
    queryKey: [...HOOKS_QUERY, webhookId, "deliveries"],
    queryFn: () => listWebhookDeliveries(webhookId),
    refetchInterval: 15_000,
  });
  const rows = query.data?.deliveries || [];
  if (query.isLoading) return <p className="text-xs text-muted-foreground">Loading deliveries…</p>;
  if (!rows.length) return <p className="text-xs text-muted-foreground">No deliveries yet.</p>;
  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-xs">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-x-2 rounded-md bg-muted/40 px-2 py-1">
          <span className={`font-medium ${STATUS_STYLE[row.status] || ""}`}>{row.status}</span>
          <span className="font-mono text-[10px]">{row.eventType}</span>
          <span className="text-muted-foreground">
            {row.lastStatusCode ? `HTTP ${row.lastStatusCode}` : row.lastError || ""}
            {row.attempts > 1 ? ` · ${row.attempts} attempts` : ""}
            {row.status === "FAILED" ? ` · retry ${formatRelative(row.nextAttemptAt)}` : ""}
          </span>
          <span className="ml-auto text-muted-foreground">{formatRelative(row.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Level 2 · P7 — signed webhooks for conversation events. */
export function WebhooksPanel() {
  const queryClient = useQueryClient();
  const hooksQuery = useQuery({ queryKey: HOOKS_QUERY, queryFn: listWebhooks });
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState([...WEBHOOK_EVENT_TYPES]);
  const [includeText, setIncludeText] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [newSecret, setNewSecret] = useState(null);
  const [openDeliveries, setOpenDeliveries] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: HOOKS_QUERY });

  async function create(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const result = await createWebhook({ url: url.trim(), events, includeMessageText: includeText });
      setNewSecret(result.secret);
      setUrl("");
      await refresh();
    } catch (err) {
      setError(err.message || "Could not add the webhook");
    } finally {
      setCreating(false);
    }
  }

  async function run(id, action, success) {
    setBusyId(id);
    try {
      const result = await action();
      if (success) toast.success(typeof success === "function" ? success(result) : success);
      await refresh();
      return result;
    } catch (err) {
      toast.error(err.message || "Something went wrong");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  const hooks = hooksQuery.data?.webhooks || [];

  return (
    <section className="aide-card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="webhooks-heading">
      <div>
        <h2 id="webhooks-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Webhook className="size-4" aria-hidden /> Webhooks
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          We POST signed JSON to your HTTPS endpoint when these events happen. Verify{" "}
          <code className="font-mono">x-aide-signature</code> (HMAC-SHA256 of <code className="font-mono">timestamp.body</code>{" "}
          with your signing secret). Failed deliveries are retried for about 15 hours; order is not guaranteed.
        </p>
      </div>

      <form onSubmit={create} className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/aide-webhook"
          aria-label="Webhook URL"
          className="h-9"
        />
        <EventPicker value={events} onChange={setEvents} idPrefix="new-hook" />
        <label className="flex items-center justify-between gap-3 text-xs text-foreground">
          <span>
            Include message text
            <span className="block text-[11px] text-muted-foreground">Off by default — events carry ids only. Team notes are never sent.</span>
          </span>
          <Switch checked={includeText} onCheckedChange={setIncludeText} aria-label="Include message text" />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="sm" className="self-start" disabled={!url.trim() || !events.length || creating}>
          {creating ? <Spinner data-icon="inline-start" /> : null} Add webhook
        </Button>
      </form>

      {hooksQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading webhooks…
        </p>
      ) : hooksQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {hooksQuery.error?.message || "Could not load webhooks"}
        </p>
      ) : hooks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">No webhooks yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {hooks.map((hook) => (
            <li key={hook.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={hook.url}>
                  {hook.url}
                </p>
                {!hook.enabled ? (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    Off
                  </Badge>
                ) : hook.consecutiveFailures > 0 ? (
                  <Badge variant="outline" className="rounded-full text-[10px] text-amber-700 dark:text-amber-400">
                    {hook.consecutiveFailures} failing
                  </Badge>
                ) : null}
                <Switch
                  checked={hook.enabled}
                  disabled={busyId === hook.id}
                  onCheckedChange={(enabled) => run(hook.id, () => updateWebhook(hook.id, { enabled }))}
                  aria-label={`Webhook ${hook.url} enabled`}
                />
              </div>
              {hook.disabledReason ? <p className="mt-1 text-xs text-destructive">{hook.disabledReason}</p> : null}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {hook.events.length} event{hook.events.length === 1 ? "" : "s"} · message text{" "}
                {hook.includeMessageText ? "included" : "not included"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === hook.id}
                  onClick={() =>
                    run(hook.id, () => sendTestWebhook(hook.id), (result) =>
                      result?.delivery?.status === "SUCCEEDED"
                        ? `Test delivered (HTTP ${result.delivery.statusCode})`
                        : `Test failed: ${result?.delivery?.error || "no response"}`
                    )
                  }
                >
                  Send test
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpenDeliveries(openDeliveries === hook.id ? null : hook.id)}
                  aria-expanded={openDeliveries === hook.id}
                >
                  Deliveries
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyId === hook.id}
                  onClick={async () => {
                    const result = await run(hook.id, () => rotateWebhookSecret(hook.id));
                    if (result?.secret) setNewSecret(result.secret);
                  }}
                >
                  New signing secret
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => run(hook.id, () => updateWebhook(hook.id, { includeMessageText: !hook.includeMessageText }), "Saved")}
                >
                  {hook.includeMessageText ? "Stop sending text" : "Send message text"}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(hook)}>
                  Delete
                </Button>
              </div>
              {openDeliveries === hook.id ? (
                <div className="mt-2">
                  <Deliveries webhookId={hook.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <SecretOnceDialog
        secret={newSecret}
        title="Signing secret"
        description="Use it to verify the x-aide-signature header on every request we send."
        onClose={() => setNewSecret(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this webhook?"
        description="We stop sending events to this URL. Its delivery history is removed."
        confirmLabel="Delete webhook"
        onConfirm={async () => {
          await deleteWebhook(deleting.id);
          await refresh();
        }}
      />
    </section>
  );
}
