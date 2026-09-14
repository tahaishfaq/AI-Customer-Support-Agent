"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSectionIntro } from "@/components/landing/LandingSectionIntro";
import { BillingIntervalToggle } from "@/components/billing/BillingIntervalToggle";
import { PlanCompareDialog } from "@/components/billing/PlanCompareDialog";
import { PlanLimitsStrip } from "@/components/billing/PlanLimitsStrip";
import {
  formatPlanPriceLabel,
  formatPlanPriceNote,
  isPlanComingSoon,
  planBestFor,
} from "@/lib/billing/plan-labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState("month");
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/plans", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          setPlans(Array.isArray(data.plans) ? data.plans : []);
        }
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="plans"
      className="landing-section landing-section-grid bg-[var(--landing-panel)]"
    >
      <div className="landing-dot-b px-5 py-8 sm:px-6 sm:py-10 lg:px-8">
        <LandingSectionIntro
          eyebrow="Plans"
          eyebrowClassName="text-[var(--color-primary)]"
          title="Plans for every stage of your journey."
        />

        <LandingReveal delay={70}>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <BillingIntervalToggle
              value={billingInterval}
              onChange={setBillingInterval}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="landing-dot-frame bg-card text-foreground"
              onClick={() => setCompareOpen(true)}
              disabled={!plans.length}
            >
              Compare plans
            </Button>
          </div>
        </LandingReveal>
      </div>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <LandingReveal delay={40}>
          {loading ? (
            <ul className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <li
                  key={i}
                  className="landing-dot-frame h-[24rem] animate-pulse bg-card/60"
                />
              ))}
            </ul>
          ) : (
            <ul className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
              {plans.map((plan) => {
                const isFeatured = plan.isPopular;
                const isComingSoon = plan.comingSoon || isPlanComingSoon(plan);
                const isCustom = plan.planType === "CUSTOM";
                const href = isCustom
                  ? "/register?plan=custom"
                  : "/register";

                return (
                  <li
                    key={plan.id}
                    className={cn(
                      "group relative flex flex-col overflow-hidden bg-card text-card-foreground transition-all duration-300",
                      "landing-dot-frame",
                      isComingSoon && "opacity-90",
                      isFeatured
                        ? "xl:-mt-2 xl:mb-[-0.5rem] xl:scale-[1.02] [border-color:color-mix(in_oklch,var(--color-primary)_45%,transparent)]"
                        : "hover:-translate-y-1"
                    )}
                  >
                    {isComingSoon ? (
                      <div className="bg-muted px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">
                        Coming soon
                      </div>
                    ) : isFeatured ? (
                      <div className="bg-primary px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide text-primary-foreground">
                        Popular
                      </div>
                    ) : null}

                    <div className="flex flex-1 flex-col p-4 sm:p-6">
                      <div className="landing-dot-b mb-4 flex items-start justify-between gap-3 pb-4 sm:hidden">
                        <p className="pt-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          {plan.name}
                        </p>
                        <div className="text-right">
                          <p className="landing-display text-[1.5rem] leading-none text-foreground">
                            {formatPlanPriceLabel(plan, billingInterval)}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatPlanPriceNote(plan, billingInterval)}
                          </p>
                        </div>
                      </div>

                      <div className="hidden min-h-[6.5rem] sm:block">
                        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          {planBestFor(plan)}
                        </p>
                        <h3 className="landing-display mt-2 text-[1.6rem] leading-tight text-foreground">
                          {plan.name}
                        </h3>
                        <p className="mt-2 hidden text-[13px] leading-relaxed text-muted-foreground sm:block">
                          {plan.description}
                        </p>
                      </div>

                      <div className="landing-dot-t mt-4 hidden pt-4 sm:mt-5 sm:block sm:pt-5">
                        <p className="landing-display text-[1.85rem] leading-none text-foreground">
                          {formatPlanPriceLabel(plan, billingInterval)}
                        </p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {formatPlanPriceNote(plan, billingInterval)}
                        </p>
                      </div>

                      <PlanLimitsStrip plan={plan} className="mt-4 sm:mt-5" compact />

                      {isComingSoon ? (
                        <span
                          className="mt-4 inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground sm:mt-5 sm:h-11"
                          aria-disabled="true"
                        >
                          Coming soon
                        </span>
                      ) : (
                        <Link
                          href={href}
                          className={cn(
                            "mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-90 sm:mt-5 sm:h-11",
                            isFeatured
                              ? "bg-primary text-primary-foreground"
                              : "landing-btn-ink"
                          )}
                        >
                          {isCustom ? "Contact us" : "Get started"}
                          <ArrowUpRight className="size-4" />
                        </Link>
                      )}

                      <ul className="landing-dot-t mt-4 flex-1 space-y-1.5 pt-4 sm:mt-5 sm:space-y-2 sm:pt-5">
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
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </LandingReveal>

        <LandingReveal delay={70} />
      </div>

      <PlanCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        plans={plans}
        billingInterval={billingInterval}
      />
    </section>
  );
}
