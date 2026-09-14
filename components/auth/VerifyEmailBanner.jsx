"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function VerifyEmailBanner() {
  const [needed, setNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch("/api/auth/me");
        if (cancelled) return;
        setNeeded(Boolean(data?.user && !data.user.emailVerified));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needed) return null;

  async function resend() {
    setBusy(true);
    setNote("");
    try {
      await apiFetch("/api/auth/resend-verify", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNote("If needed, a new link was sent.");
    } catch {
      setNote("Could not resend right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-border bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p>
          Verify your email to secure the account.
          {note ? (
            <span className="ml-2 text-muted-foreground">{note}</span>
          ) : null}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={busy}
          onClick={resend}
        >
          {busy ? "Sending…" : "Resend link"}
        </Button>
      </div>
    </div>
  );
}
