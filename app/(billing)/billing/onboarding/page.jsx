import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "@/components/billing/OnboardingForm";
import { needsUserOnboarding } from "@/lib/services/user-onboarding.service";
import { isBillingUnlocked } from "@/lib/billing/access";

export const metadata = {
  title: "Tell us about you — AIDE",
};

export default async function BillingOnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/billing/onboarding");
  }

  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }

  const needsOnboarding = await needsUserOnboarding(
    session.user.id,
    session.user.role || "USER"
  );

  if (!needsOnboarding) {
    const unlocked = await isBillingUnlocked(
      session.user.id,
      session.user.role || "USER"
    );
    redirect(unlocked ? "/dashboard" : "/billing/plans");
  }

  const nameParts = String(session.user.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    <main className="aide-container flex min-h-dvh flex-col items-center justify-center px-6 py-10 sm:px-8 sm:py-14">
      <div className="w-full max-w-xl text-center">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-primary uppercase">
          Step 1 of 2
        </p>
        <h1 className="landing-display mt-3 text-[2rem] leading-[1.15] text-foreground sm:text-4xl">
          A few details to get you set up
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Tell us who you are and what you need — then pick a plan. Website is
          optional; we can learn it after you&apos;re in.
        </p>
      </div>

      <div className="mt-8 w-full max-w-xl">
        <OnboardingForm
          initialFirstName={nameParts[0] || ""}
          initialLastName={nameParts.slice(1).join(" ") || ""}
          email={session.user.email || ""}
        />
      </div>
    </main>
  );
}
