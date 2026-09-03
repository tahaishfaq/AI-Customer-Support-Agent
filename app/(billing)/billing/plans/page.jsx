import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BillingPlanPicker } from "@/components/billing/BillingPlanPicker";
import { SafepayCustomerKick } from "@/components/billing/SafepayCustomerKick";
import { BASIC_PLAN_NAME } from "@/lib/billing/plan-labels";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";
import { needsUserOnboarding } from "@/lib/services/user-onboarding.service";

export const metadata = {
  title: "Choose a plan — AIDE",
};

export default async function BillingPlansPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/billing/plans");
  }

  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }

  const billing = await getBillingSnapshot(
    session.user.id,
    session.user.role || "USER"
  );

  const needsOnboarding = await needsUserOnboarding(
    session.user.id,
    session.user.role || "USER"
  );
  if (needsOnboarding) {
    redirect("/billing/onboarding");
  }

  const unlocked = billing.unlocked;

  const changeMode = unlocked;
  const currentPlanId = billing?.subscription?.planId || null;
  const sub = billing?.subscription;
  const pendingCheckout =
    sub?.status === "PENDING" || sub?.pendingPlanId ? sub : null;

  const currentPlan = sub?.plan
    ? {
        id: sub.planId,
        name: sub.plan.name,
        cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
      }
    : null;

  return (
    <main className="aide-container mx-auto flex w-full max-w-[76rem] flex-col items-center px-6 py-10 sm:px-8 sm:py-14">
      <SafepayCustomerKick />
      <div className="w-full">
        {changeMode ? (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-4 sm:justify-between">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-primary hover:underline"
            >
              ← Back to dashboard
            </Link>
            <Link
              href="/settings/billing"
              className="text-sm font-medium text-primary hover:underline"
            >
              Subscription & usage →
            </Link>
          </div>
        ) : null}

        <div className="mx-auto max-w-2xl text-center">
          {!changeMode ? (
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">
              Step 2 of 2
            </p>
          ) : null}
          <h1 className="landing-display mt-3 text-[2rem] leading-[1.15] text-foreground sm:text-4xl">
            {changeMode ? "Change your plan" : "Pick a plan to get started"}
          </h1>
          {changeMode && currentPlan ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You&apos;re on{" "}
              <span className="font-semibold text-foreground">{currentPlan.name}</span>
              {currentPlan.cancelAtPeriodEnd ? (
                <>
                  {" "}
                  — cancellation scheduled. Manage in{" "}
                  <Link href="/settings/billing" className="text-primary hover:underline">
                    Plan & billing
                  </Link>
                  .
                </>
              ) : null}
            </p>
          ) : null}
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            {changeMode
              ? "Upgrade for more conversations and higher limits, or switch to a plan that fits your team."
              : `Choose ${BASIC_PLAN_NAME} to open your workspace now. Paid plans checkout through SafePay when configured.`}
          </p>
        </div>

        <div className="mt-12 w-full">
          <BillingPlanPicker
            mode={changeMode ? "change" : "signup"}
            currentPlanId={currentPlanId}
            currentPlan={currentPlan}
            pendingCheckout={pendingCheckout}
          />
        </div>
      </div>
    </main>
  );
}
