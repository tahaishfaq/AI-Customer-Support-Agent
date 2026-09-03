"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getBillingStatus, reconcileBillingCheckout } from "@/lib/api/billing";
import { refreshConversationQuota } from "@/hooks/use-conversation-quota";
import { normalizeCheckoutReference } from "@/lib/billing/checkout-reference";
import { BillingSuccessIcon } from "@/components/billing/BillingSuccessIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function checkoutIsComplete(billing) {
  if (!billing?.subscription) return false;
  if (billing.status !== "ACTIVE") return false;
  return !billing.subscription.pendingPlanId;
}

export function BillingSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = normalizeCheckoutReference(searchParams.get("ref"));
  const subscriptionToken =
    searchParams.get("subscription_token") ||
    searchParams.get("subscription_id") ||
    searchParams.get("sub") ||
    searchParams.get("token") ||
    null;
  const [message, setMessage] = useState("Confirming your payment…");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("polling");
  const [syncing, setSyncing] = useState(false);

  const runCheck = useCallback(async () => {
    if (ref) {
      await reconcileBillingCheckout(ref, subscriptionToken).catch(() => null);
    }
    const { billing } = await getBillingStatus();
    return billing;
  }, [ref, subscriptionToken]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    async function poll() {
      while (!cancelled && attempts < maxAttempts) {
        attempts += 1;
        try {
          const snapshot = await runCheck();

          if (checkoutIsComplete(snapshot)) {
            if (!cancelled) {
              setPhase("done");
              setMessage("Payment confirmed! Redirecting…");
              refreshConversationQuota();
              router.replace("/dashboard");
              router.refresh();
            }
            return;
          }

          if (!cancelled && snapshot?.subscription?.pendingPlan) {
            setMessage(
              `Activating your ${snapshot.subscription.pendingPlan.name} plan…`
            );
          } else if (!cancelled) {
            setMessage("Confirming your payment…");
          }
        } catch (err) {
          if (!cancelled) {
            setPhase("error");
            setError(err.message || "Unable to verify payment");
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) {
        setPhase("stuck");
        setMessage(
          "Payment is taking longer than expected. Tap sync below if you already paid."
        );
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [router, runCheck]);

  async function onSync() {
    setSyncing(true);
    setError("");
    try {
      const snapshot = await runCheck();
      if (checkoutIsComplete(snapshot)) {
        setPhase("done");
        setMessage("Payment confirmed! Redirecting…");
        refreshConversationQuota();
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setMessage("Still waiting on SafePay. Try again in a few seconds.");
      setPhase("stuck");
    } catch (err) {
      setError(err.message || "Unable to sync payment");
      setPhase("error");
    } finally {
      setSyncing(false);
    }
  }

  const showActions = phase === "stuck" || phase === "error";
  const done = phase === "done";

  return (
    <main className="aide-container flex min-h-dvh items-center justify-center px-6 py-14">
      <div
        className={cn(
          "animate-fade-up w-full max-w-md rounded-2xl border border-border bg-card px-8 py-10 text-center text-card-foreground shadow-[var(--shadow-card)]"
        )}
      >
        <div className="mx-auto flex h-[4.5rem] items-center justify-center">
          {done ? (
            <BillingSuccessIcon confirmed />
          ) : (
            <Loader2
              className={cn(
                "size-12 text-primary",
                phase !== "error" && "animate-spin"
              )}
              aria-hidden
            />
          )}
        </div>

        <h1 className="landing-display mt-6 text-[1.75rem] leading-tight text-foreground">
          {done ? "You're all set!" : "Thanks!"}
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {error || message}
        </p>

        {showActions ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button type="button" disabled={syncing} onClick={onSync}>
              {syncing ? "Syncing…" : "Sync payment"}
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
