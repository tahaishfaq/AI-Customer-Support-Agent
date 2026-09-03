import { Suspense } from "react";
import { BillingSuccessClient } from "@/components/billing/BillingSuccessClient";

export const metadata = {
  title: "Payment confirmed — AIDE",
};

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="aide-container px-6 py-14 text-center">
          <p className="text-[var(--landing-muted)]">Loading…</p>
        </main>
      }
    >
      <BillingSuccessClient />
    </Suspense>
  );
}
