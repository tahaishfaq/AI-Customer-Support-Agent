"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  getBillingPlans,
  subscribeFreePlan,
  startPaidCheckout,
  reconcileBillingCheckout,
} from "@/lib/api/billing";
import { refreshConversationQuota } from "@/hooks/use-conversation-quota";
import { CustomPlanRequestForm } from "@/components/billing/CustomPlanRequestForm";
import { BillingIntervalToggle } from "@/components/billing/BillingIntervalToggle";
import { PlanCompareDialog } from "@/components/billing/PlanCompareDialog";
import { PlanLimitsStrip } from "@/components/billing/PlanLimitsStrip";
import {
  BASIC_PLAN_NAME,
  formatPlanPriceLabel,
  formatPlanPriceNote,
  isBasicPlan,
  isPlanComingSoon,
  planBestFor,
} from "@/lib/billing/plan-labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BillingPlanPicker({
  mode = "signup",
  currentPlanId = null,
  currentPlan = null,
  pendingCheckout = null,
}) {
  const router = useRouter();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [customPlanId, setCustomPlanId] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [billingInterval, setBillingInterval] = useState("month");
  const [paymentsAvailable, setPaymentsAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getBillingPlans();
        if (!cancelled) {
          setPlans(Array.isArray(data) ? data : data.plans || []);
          setPaymentsAvailable(Boolean(data?.paymentsAvailable));
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || "Unable to load plans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onBasic(plan) {
    if (mode === "change" && plan.id === currentPlanId) return;
    setBusyId(plan.id);
    try {
      await subscribeFreePlan(plan.id);
      toast.success(
        mode === "change" ? "Plan updated" : `${BASIC_PLAN_NAME} plan activated`
      );
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Unable to activate plan");
    } finally {
      setBusyId("");
    }
  }

  async function onPaid(plan) {
    if (isPlanComingSoon(plan)) {
      toast.message(
        `${plan.name} is coming soon — multi-seat features are still in progress.`
      );
      return;
    }
    if (!paymentsAvailable) {
      toast.message(
        `Paid checkout is not configured yet. Use ${BASIC_PLAN_NAME} or contact support.`
      );
      return;
    }
    if (billingInterval === "year") {
      toast.message(
        "Yearly billing is coming soon. Checkout currently runs monthly — you can still compare yearly pricing here."
      );
    }
    setBusyId(plan.id);
    try {
      const { url } = await startPaidCheckout(plan.id);
      if (url) {
        window.location.href = url;
        return;
      }
      toast.error("No checkout URL returned");
    } catch (err) {
      toast.error(err.message || "Unable to start checkout");
    } finally {
      setBusyId("");
    }
  }

  function onCustom(plan) {
    setCustomPlanId(plan.id);
    setCustomOpen(true);
  }

  async function onSyncPayment() {
    setSyncing(true);
    try {
      const result = await reconcileBillingCheckout(
        pendingCheckout?.checkoutReference || null
      );
      if (result.activated) {
        toast.success(
          `Plan updated to ${result.billing?.subscription?.plan?.name || "paid plan"}`
        );
        refreshConversationQuota();
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (result.reason === "awaiting_webhook") {
        toast.message("Still waiting on SafePay — try again in a few seconds");
      } else {
        toast.message("No pending payment to sync");
      }
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Unable to sync payment");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto grid w-full max-w-[68rem] gap-5 pt-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[24rem] animate-pulse rounded-xl border border-border bg-muted/40"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {pendingCheckout ? (
        <div className="mx-auto mb-8 max-w-2xl rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-center text-sm text-foreground">
          <p className="font-medium">
            {pendingCheckout.pendingPlan
              ? `Upgrade to ${pendingCheckout.pendingPlan.name} — payment not finished`
              : `Payment in progress for ${pendingCheckout.plan?.name || "your selected plan"}`}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {mode === "signup" ? (
              <>
                Click <strong>Subscribe</strong> again to continue SafePay checkout, or
                choose <strong>{BASIC_PLAN_NAME}</strong> to skip payment and open your
                workspace now.
              </>
            ) : (
              <>
                Click <strong>Continue checkout</strong> on{" "}
                {pendingCheckout.pendingPlan?.name || pendingCheckout.plan?.name} to
                pay in SafePay. Already paid? Use <strong>Sync payment</strong> below.
              </>
            )}
          </p>
          {mode === "change" ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={syncing}
                onClick={onSyncPayment}
              >
                {syncing ? "Syncing…" : "Sync payment"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
        <BillingIntervalToggle
          value={billingInterval}
          onChange={setBillingInterval}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border bg-card text-foreground"
          onClick={() => setCompareOpen(true)}
        >
          Compare plans
        </Button>
      </div>

      <div className="mx-auto grid w-full max-w-[68rem] items-stretch gap-5 pt-2 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isFeatured = plan.isPopular;
          const isBasic = isBasicPlan(plan);
          const isCustom = plan.planType === "CUSTOM";
          const isComingSoon = plan.comingSoon || isPlanComingSoon(plan);
          const isPaid =
            (plan.planType === "POPULAR" || plan.planType === "TEAMS") &&
            !isComingSoon;
          const isCurrent = Boolean(currentPlanId && plan.id === currentPlanId);
          const isPendingUpgrade = Boolean(
            pendingCheckout &&
              (pendingCheckout.pendingPlan?.id === plan.id ||
                (pendingCheckout.status === "PENDING" &&
                  pendingCheckout.planId === plan.id))
          );

          return (
            <article
              key={plan.id}
              className={cn(
                "flex min-h-[24rem] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-[var(--shadow-card)]",
                isComingSoon && !isCurrent && "opacity-90",
                isCurrent
                  ? "border-primary/50 ring-2 ring-primary/20"
                  : isFeatured
                    ? "border-primary/30"
                    : "border-border"
              )}
            >
              {isPendingUpgrade ? (
                <div className="bg-amber-500 px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-white dark:bg-amber-600">
                  Complete payment
                </div>
              ) : isCurrent ? (
                <div className="bg-foreground px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-background">
                  Current plan
                </div>
              ) : isComingSoon ? (
                <div className="bg-muted px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">
                  Coming soon
                </div>
              ) : isFeatured ? (
                <div className="bg-primary px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-primary-foreground">
                  Popular
                </div>
              ) : null}

              <div className="flex flex-1 flex-col px-5 py-5 sm:px-6">
                <div className="min-h-[7rem]">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {planBestFor(plan)}
                  </p>
                  <h2 className="landing-display mt-2 text-[1.6rem] leading-tight text-foreground">
                    {plan.name}
                  </h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-5 border-t border-border pt-5">
                  <p className="landing-display text-[1.85rem] leading-none text-foreground">
                    {formatPlanPriceLabel(plan, billingInterval)}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {formatPlanPriceNote(plan, billingInterval)}
                  </p>
                </div>

                <PlanLimitsStrip plan={plan} className="mt-5" compact />

                <ul className="mt-5 flex-1 space-y-2 border-t border-border pt-5">
                  {(plan.features || []).map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="mt-5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-center text-sm text-foreground">
                    <p className="font-medium">Your active plan</p>
                    {currentPlan?.cancelAtPeriodEnd ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cancellation scheduled — access continues until the period ends.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="mt-5 w-full"
                    variant={
                      isPendingUpgrade || (isFeatured && !isComingSoon)
                        ? "default"
                        : "outline"
                    }
                    disabled={
                      busyId === plan.id || (isComingSoon && !isCurrent)
                    }
                    onClick={() => {
                      if (isComingSoon) return;
                      if (isBasic) onBasic(plan);
                      else if (isCustom) onCustom(plan);
                      else if (isPaid) onPaid(plan);
                    }}
                  >
                    {isComingSoon
                      ? "Coming soon"
                      : busyId === plan.id
                        ? "Redirecting…"
                        : isBasic
                          ? mode === "change"
                            ? `Switch to ${BASIC_PLAN_NAME}`
                            : `Start ${BASIC_PLAN_NAME}`
                          : isCustom
                            ? "Contact us"
                            : paymentsAvailable
                              ? isPendingUpgrade
                                ? "Continue checkout"
                                : mode === "change"
                                  ? "Upgrade"
                                  : "Subscribe"
                              : "Payments unavailable"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <CustomPlanRequestForm
        planId={customPlanId}
        open={customOpen}
        onOpenChange={setCustomOpen}
      />

      <PlanCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        plans={plans}
        billingInterval={billingInterval}
      />
    </>
  );
}
