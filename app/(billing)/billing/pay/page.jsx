"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AtomsCheckoutForm } from "@/components/billing/AtomsCheckoutForm";
import { startAtomsPaymentSession } from "@/lib/api/billing";
import { Button } from "@/components/ui/button";

function BillingPayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId") || "";
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) {
      setLoading(false);
      setError("Missing plan. Choose a plan again.");
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await startAtomsPaymentSession(planId);
        if (!cancelled) setSession(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to start payment");
          toast.error(err.message || "Unable to start payment");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [planId]);

  return (
    <main className="aide-container mx-auto flex w-full max-w-lg flex-col px-6 py-10 sm:px-8 sm:py-14">
      <Link
        href="/billing/plans"
        className="text-sm font-medium text-primary hover:underline"
      >
        ← Back to plans
      </Link>
      <h1 className="landing-display mt-6 text-[1.75rem] leading-tight text-foreground sm:text-3xl">
        Complete payment
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Card details stay with SafePay. AIDE never sees your full card number.
      </p>

      <div className="mt-8">
        {loading ? (
          <div className="h-48 animate-pulse rounded-xl border border-border bg-muted/40" />
        ) : error && !session ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
            <Button type="button" onClick={() => router.push("/billing/plans")}>
              Choose a plan
            </Button>
          </div>
        ) : (
          <AtomsCheckoutForm session={session} />
        )}
      </div>
    </main>
  );
}

export default function BillingPayPage() {
  return (
    <Suspense
      fallback={
        <main className="aide-container mx-auto max-w-lg px-6 py-14">
          <div className="h-48 animate-pulse rounded-xl border border-border bg-muted/40" />
        </main>
      }
    >
      <BillingPayInner />
    </Suspense>
  );
}
