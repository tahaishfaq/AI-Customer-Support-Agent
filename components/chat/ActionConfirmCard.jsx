"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  try {
    return new Date(expiresAt).getTime() < Date.now();
  } catch {
    return false;
  }
}

function argsPreview(args) {
  if (!args || typeof args !== "object") return null;
  const entries = Object.entries(args).filter(
    ([, v]) => v != null && String(v).trim() !== ""
  );
  if (!entries.length) return null;
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 48)}`)
    .join(" · ");
}

/**
 * F14-A — In-chat Confirm / Cancel for a pending ActionConfirmation.
 */
export function ActionConfirmCard({
  confirmation,
  themed = false,
  busy = false,
  onDecision,
}) {
  const [localStatus, setLocalStatus] = useState(confirmation?.status || "PENDING");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!confirmation?.id) return null;

  const status = localStatus || confirmation.status || "PENDING";
  const expired =
    status === "EXPIRED" ||
    (status === "PENDING" && isExpired(confirmation.expiresAt));
  const preview = argsPreview(confirmation.args);
  const label =
    confirmation.actionDescription ||
    confirmation.actionName ||
    "this action";

  async function handle(decision) {
    if (pending || busy || expired || status !== "PENDING") return;
    setPending(true);
    setError("");
    try {
      await onDecision?.(confirmation, decision);
      setLocalStatus(decision === "deny" ? "DENIED" : "APPROVED");
    } catch (err) {
      const code = err?.details?.code;
      if (code === "CONFIRMATION_EXPIRED" || /expired/i.test(err?.message || "")) {
        setLocalStatus("EXPIRED");
      } else if (err?.status === 429 || /too many/i.test(err?.message || "")) {
        setError("Too many attempts — wait a moment and try again.");
      } else {
        setError(err?.message || "Unable to update confirmation");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "mt-2 max-w-[85%] rounded-xl border px-3 py-2.5 sm:max-w-[75%]",
        themed
          ? "border-[var(--wc-primary)]/25 bg-[var(--wc-assistant-bg)]"
          : "border-border bg-muted/40"
      )}
    >
      <p className="text-xs font-medium text-foreground">
        Confirm: {label}
      </p>
      {preview ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{preview}</p>
      ) : null}

      {expired || status === "EXPIRED" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          This confirmation expired — ask again.
        </p>
      ) : status === "APPROVED" ? (
        <p className="mt-2 text-xs font-medium text-primary">Confirmed ✓</p>
      ) : status === "DENIED" ? (
        <p className="mt-2 text-xs font-medium text-muted-foreground">Denied</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || busy}
            onClick={() => handle("approve")}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Confirm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || busy}
            onClick={() => handle("deny")}
          >
            Cancel
          </Button>
        </div>
      )}
      {error ? (
        <p className="mt-1.5 text-[11px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
