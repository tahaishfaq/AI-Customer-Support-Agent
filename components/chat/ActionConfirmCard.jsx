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
  const [localStatus, setLocalStatus] = useState(null);
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
        "mt-3 min-w-0 max-w-[85%] rounded-xl border border-border bg-background p-3.5 text-foreground shadow-none sm:max-w-[75%]",
        !themed && "bg-muted/40"
      )}
      style={themed ? {
        "--background": "var(--wc-shell)",
        "--foreground": "var(--wc-shell-fg)",
        "--muted": "var(--wc-input-bg)",
        "--muted-foreground": "var(--wc-muted)",
        "--border": "var(--wc-input-border)",
        "--input": "var(--wc-input-border)",
        "--primary": "var(--wc-shell-fg)",
        "--primary-foreground": "var(--wc-shell)",
        "--ring": "var(--wc-primary)",
      } : undefined}
      data-testid="action-confirm-card"
    >
      <p className="text-xs font-semibold text-foreground">
        {status === "PENDING" && !expired ? "Confirmation required" : "Confirmation"}
      </p>
      <p className="mt-1.5 break-words text-[13px] leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {label}
      </p>
      {preview ? (
        <p className="mt-2 break-words text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{preview}</p>
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
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="solid"
            className="min-h-9 min-w-24 flex-1"
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
            className="min-h-9 min-w-24 flex-1"
            disabled={pending || busy}
            onClick={() => handle("deny")}
          >
            Cancel
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 break-words text-xs leading-relaxed text-destructive [overflow-wrap:anywhere]">{error}</p>
      ) : null}
    </div>
  );
}
