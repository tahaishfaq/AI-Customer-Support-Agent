"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  cancelSubscription,
  reconcileBillingCheckout,
} from "@/lib/api/billing";
import { ConversationQuotaMeter } from "@/components/billing/ConversationQuotaMeter";
import { useConversationQuota, refreshConversationQuota } from "@/hooks/use-conversation-quota";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/layout/PageHeader";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export function BillingSettings() {
  const router = useRouter();
  const { quota, billing, loading, reload } = useConversationQuota();
  const [canceling, setCanceling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const sub = billing?.subscription;
  const plan = sub?.plan;
  const pendingUpgrade = Boolean(sub?.pendingPlan);
  const isPaid = plan?.planType === "POPULAR" || plan?.planType === "TEAMS";
  const canCancel =
    sub?.status === "ACTIVE" && isPaid && !sub?.cancelAtPeriodEnd;

  async function onSyncPayment() {
    setSyncing(true);
    try {
      const result = await reconcileBillingCheckout(sub?.checkoutReference || null);
      if (result.activated) {
        toast.success(`Plan updated to ${result.billing?.subscription?.plan?.name || "paid plan"}`);
      } else if (result.reason === "already_active" && !pendingUpgrade) {
        toast.message("Your plan is already active");
      } else if (result.reason === "no_open_checkout") {
        toast.message("No pending checkout to sync");
      } else {
        toast.message("Still waiting on SafePay — try again in a moment");
      }
      refreshConversationQuota();
      await reload();
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Unable to sync payment");
    } finally {
      setSyncing(false);
    }
  }

  async function handleCancelConfirm() {
    setCanceling(true);
    setCancelError("");
    try {
      await cancelSubscription();
      toast.success("Cancellation requested");
      await reload();
      router.refresh();
    } catch (err) {
      setCancelError(err.message || "Unable to cancel");
      throw err;
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading billing…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your plan, usage, and subscription status."
      />

      {quota ? (
        <ConversationQuotaMeter
          quota={quota}
          billing={billing}
          variant="strip"
          showUpgrade={false}
        />
      ) : null}

      <section className="aide-card px-4 py-4">
        <h2 className="text-sm font-semibold text-foreground">Current plan</h2>
        {sub ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium">{plan?.name || billing?.planSlug}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{sub.status}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Activated</dt>
              <dd>{formatWhen(sub.activatedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last payment</dt>
              <dd>{formatWhen(sub.lastPaymentAt)}</dd>
            </div>
            {sub.currentPeriodEnd ? (
              <div>
                <dt className="text-muted-foreground">Period ends</dt>
                <dd>{formatWhen(sub.currentPeriodEnd)}</dd>
              </div>
            ) : null}
            {sub?.pendingPlan ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Checkout in progress</dt>
                <dd className="font-medium">
                  Switching to {sub.pendingPlan.name} — finish payment in SafePay or
                  try again from{" "}
                  <Link href="/billing/plans" className="text-primary hover:underline">
                    plans
                  </Link>
                  .
                </dd>
              </div>
            ) : null}
            {sub.cancelAtPeriodEnd ? (
              <div className="sm:col-span-2">
                <p className="text-amber-700 dark:text-amber-300">
                  Cancellation scheduled — access continues until the period ends.
                </p>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No active subscription.{" "}
            <Link href="/billing/plans" className="text-primary hover:underline">
              Choose a plan
            </Link>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {pendingUpgrade || sub?.status === "PENDING" ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={syncing}
              onClick={onSyncPayment}
            >
              {syncing ? "Syncing…" : "Sync payment"}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={canceling}
              onClick={() => {
                setCancelError("");
                setCancelOpen(true);
              }}
            >
              Cancel subscription
            </Button>
          ) : null}
        </div>
      </section>

      {billing?.status === "PAST_DUE" ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Your last payment failed. Update your payment method in SafePay or
          resubscribe from{" "}
          <Link href="/billing/plans" className="font-medium text-primary hover:underline">
            plans
          </Link>
          .
        </p>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setCancelError("");
        }}
        title="Cancel subscription?"
        description="Your paid plan will be canceled at SafePay. You keep access until the current billing period ends, then your account moves back to Basic."
        confirmLabel="Yes, cancel subscription"
        cancelLabel="Keep subscription"
        variant="destructive"
        loading={canceling}
        error={cancelError}
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
}
