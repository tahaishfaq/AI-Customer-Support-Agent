import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BillingPlanPicker } from "@/components/billing/BillingPlanPicker";
import { BASIC_PLAN_NAME } from "@/lib/billing/plan-labels";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";

export const metadata = {
  title: "Checkout canceled — AIDE",
};

export default async function BillingCanceledPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/billing/canceled");
  }

  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }

  const billing = await getBillingSnapshot(
    session.user.id,
    session.user.role || "USER"
  );
  const unlocked = billing.unlocked;
  const changeMode = unlocked;
  const currentPlanId = billing?.subscription?.planId || null;
  const sub = billing?.subscription;
  const pendingCheckout =
    sub?.status === "PENDING" || sub?.pendingPlanId ? sub : null;

  return (
    <main className="aide-container mx-auto flex w-full max-w-[76rem] flex-col items-center px-6 py-10 sm:px-8 sm:py-14">
      <div className="w-full">
        {changeMode ? (
          <p className="mb-8 text-center sm:text-left">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-primary hover:underline"
            >
              ← Back to dashboard
            </Link>
          </p>
        ) : null}

        <div className="mx-auto max-w-2xl text-center">
          <h1 className="landing-display text-[2rem] leading-[1.15] text-foreground sm:text-3xl">
            Checkout canceled
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            No charge was made. Pick a plan below — upgrade to Popular, or stay on{" "}
            {BASIC_PLAN_NAME}.
          </p>
        </div>

        <div className="mt-10 w-full">
          <BillingPlanPicker
            mode={changeMode ? "change" : "signup"}
            currentPlanId={currentPlanId}
            pendingCheckout={pendingCheckout}
          />
        </div>
      </div>
    </main>
  );
}
