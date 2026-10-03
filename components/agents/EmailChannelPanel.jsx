"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";

/**
 * Level 2 · M1 — owner setup for Resend inbound email → same Inbox as embed.
 * DNS steps are a static checklist (no live MX probe).
 */
export function EmailChannelPanel({ agent, onSaved }) {
  const initial = useMemo(() => {
    const channel =
      agent?.emailChannel && typeof agent.emailChannel === "object"
        ? agent.emailChannel
        : {};
    return {
      enabled: Boolean(agent?.emailChannelAddress) && channel.enabled !== false,
      address: agent?.emailChannelAddress || "",
      fromName: channel.fromName || "Support",
    };
  }, [agent]);

  const [enabled, setEnabled] = useState(initial.enabled);
  const [address, setAddress] = useState(initial.address);
  const [fromName, setFromName] = useState(initial.fromName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [appOrigin, setAppOrigin] = useState(() =>
    String(process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app").replace(
      /\/$/,
      ""
    )
  );

  useEffect(() => {
    setEnabled(initial.enabled);
    setAddress(initial.address);
    setFromName(initial.fromName);
  }, [initial]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setAppOrigin(window.location.origin.replace(/\/$/, ""));
    }
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch(`/api/agents/${agent.id}/email-channel`, {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          address: address.trim(),
          fromName: fromName.trim() || "Support",
        }),
      });
      onSaved?.(updated);
      toast.success(enabled ? "Email channel saved" : "Email channel disabled");
    } catch (err) {
      setError(err.message || "Could not save email channel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="aide-card flex flex-col gap-4 p-4 sm:p-5"
      aria-labelledby="email-channel-heading"
    >
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="email-channel-heading"
            className="text-sm font-semibold text-foreground"
          >
            Email channel
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Customers email this address; Aide answers in Inbox (same brain as
            embed). Needs Resend inbound + MX on your domain.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label htmlFor="email-channel-enabled" className="text-xs">
            Enabled
          </Label>
          <Switch
            id="email-channel-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={saving}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="email-channel-address">Inbound address</Label>
          <Input
            id="email-channel-address"
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="support@help.yourdomain.com"
            disabled={saving || !enabled}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email-channel-from">From name</Label>
          <Input
            id="email-channel-from"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Support"
            disabled={saving || !enabled}
          />
        </div>
      </div>

      <ol className="list-decimal space-y-1.5 rounded-lg border border-border bg-muted/40 px-4 py-3 pl-8 text-xs text-muted-foreground">
        <li>
          In Resend, add MX for the receiving domain (e.g.{" "}
          <code className="text-[11px]">help.yourdomain.com</code>).
        </li>
        <li>
          Set env <code className="text-[11px]">RESEND_API_KEY</code> and{" "}
          <code className="text-[11px]">RESEND_INBOUND_SECRET</code> (
          <code className="text-[11px]">whsec_…</code>).
        </li>
        <li>
          Webhook for <code className="text-[11px]">email.received</code> →{" "}
          <code className="break-all text-[11px]">
            {appOrigin}/api/webhooks/email-inbound
          </code>
        </li>
        <li>Save the address above, then send a test email to it.</li>
      </ol>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save email channel"}
        </Button>
      </div>
    </section>
  );
}
