"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Check,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSectionIntro } from "@/components/landing/LandingSectionIntro";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "free",
    name: "Free",
    blurb: "Start shipping support agents.",
    bestFor: "Solo builders",
    icon: Zap,
    cta: "Get started",
    href: "/register",
    featured: false,
    priceMonthly: "Free",
    priceYearly: "Free",
    priceNote: "Forever free",
    features: [
      "1 AI support agent",
      "Knowledge FAQs + docs",
      "Embed widget",
      "Conversation history",
      "Community support",
    ],
  },
  {
    id: "popular",
    name: "Popular",
    blurb: "For growing support volume.",
    bestFor: "Most teams",
    icon: Sparkles,
    cta: "Get started",
    href: "/register",
    featured: true,
    priceMonthly: 3500,
    priceYearly: 3500,
    priceNote: "PKR",
    features: [
      "Multiple agents",
      "Higher conversation limits",
      "HTTP tools + confirm flows",
      "Human desk handoff",
      "Analytics & insights",
      "Priority support",
    ],
  },
  {
    id: "teams",
    name: "Teams",
    blurb: "Higher caps for multi-agent work.",
    bestFor: "Multi-seat ops",
    icon: Users,
    cta: "Get started",
    href: "/register",
    featured: false,
    priceMonthly: 7500,
    priceYearly: 7500,
    priceNote: "PKR",
    features: [
      "Everything in Popular",
      "Higher workspace limits",
      "Advanced analytics",
      "Shared inbox workflows",
      "Priority onboarding",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    blurb: "Tailored limits and security.",
    bestFor: "Enterprise",
    icon: Building2,
    cta: "Contact us",
    href: "/register?plan=custom",
    featured: false,
    priceMonthly: "Contact",
    priceYearly: "Contact",
    priceNote: "Volume pricing",
    features: [
      "Custom agent & volume limits",
      "Security review support",
      "Dedicated success path",
      "Contract & invoice options",
      "Roadmap input",
    ],
  },
];

function formatPrice(value) {
  if (typeof value === "number") {
    return `Rs ${value.toLocaleString("en-PK")}`;
  }
  return value;
}

export function LandingPlans() {
  const [annual, setAnnual] = useState(true);

  return (
    <section
      id="plans"
      className="scroll-mt-24 border-y border-black/5 bg-[var(--landing-panel)] px-6 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <LandingSectionIntro
          eyebrow="Plans"
          eyebrowClassName="text-[var(--color-primary)]"
          title="Plans for every stage of your journey."
          description="Four fixed slots — Free, Popular, Teams, and Custom. Upgrade as your conversations grow."
        />

        <LandingReveal delay={70}>
          <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                !annual
                  ? "bg-[var(--landing-ink)] text-white"
                  : "text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                annual
                  ? "bg-[var(--landing-ink)] text-white"
                  : "text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              )}
            >
              Yearly
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                  annual
                    ? "bg-white/15 text-white"
                    : "bg-[var(--color-primary)]/12 text-[var(--color-primary)]"
                )}
              >
                Save
              </span>
            </button>
          </div>
          </div>
        </LandingReveal>

        <LandingReveal delay={40}>
        <ul className="mt-12 grid items-stretch gap-4 sm:mt-14 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const priceValue = annual ? plan.priceYearly : plan.priceMonthly;
            const isPaid = typeof plan.priceMonthly === "number";

            return (
              <li
                key={plan.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-[1.5rem] border transition-all duration-300",
                  plan.featured
                    ? "border-[var(--color-primary)]/40 bg-white shadow-[0_28px_70px_-28px_color-mix(in_oklch,var(--primary)_50%,transparent)] xl:-mt-3 xl:mb-[-0.75rem] xl:scale-[1.02]"
                    : "border-black/[0.06] bg-white/80 hover:-translate-y-1 hover:border-black/10 hover:bg-white hover:shadow-[0_22px_50px_-28px_rgba(20,16,12,0.35)]"
                )}
              >
                {plan.featured ? (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 bg-[var(--color-primary)]"
                  />
                ) : null}

                <div className="flex flex-1 flex-col p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--landing-muted)] uppercase">
                        {plan.bestFor}
                      </p>
                      <h3 className="landing-display mt-1.5 text-[1.65rem] text-[var(--landing-ink)]">
                        {plan.name}
                      </h3>
                    </div>
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                        plan.featured
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[#f3f1ee] text-[var(--landing-ink)]"
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                  </div>

                  <p className="mt-3 text-[13px] leading-relaxed text-[var(--landing-muted)]">
                    {plan.blurb}
                  </p>

                  <div className="mt-6">
                    <p className="landing-display text-[2rem] leading-none text-[var(--landing-ink)]">
                      {formatPrice(priceValue)}
                    </p>
                    <p className="mt-1.5 text-[12px] text-[var(--landing-muted)]">
                      {isPaid
                        ? annual
                          ? "PKR · billed yearly"
                          : "PKR / month"
                        : plan.priceNote}
                    </p>
                    {isPaid && annual && plan.priceYearly !== plan.priceMonthly ? (
                      <p className="mt-1 text-[11px] text-[var(--landing-muted)]">
                        {formatPrice(plan.priceMonthly)} / mo billed yearly
                      </p>
                    ) : null}
                  </div>

                  {plan.featured ? (
                    <span className="mt-4 inline-flex w-fit rounded-full bg-[var(--color-primary)]/12 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[var(--color-primary)] uppercase">
                      Most popular
                    </span>
                  ) : (
                    <span className="mt-4 h-[26px]" aria-hidden />
                  )}

                  <Link
                    href={plan.href}
                    className={cn(
                      "mt-5 inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90",
                      plan.featured
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--landing-ink)] text-white"
                    )}
                  >
                    {plan.cta}
                    <ArrowUpRight className="size-4" />
                  </Link>

                  <ul className="mt-7 space-y-3 border-t border-black/[0.05] pt-6">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-[13px] leading-snug text-[var(--landing-ink)]"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                            plan.featured
                              ? "bg-[var(--color-primary)] text-white"
                              : "bg-[var(--color-primary)]/12 text-[var(--color-primary)]"
                          )}
                        >
                          <Check className="size-2.5 stroke-[3]" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
        </LandingReveal>

        <LandingReveal delay={70}>
        <p className="mx-auto mt-10 max-w-xl text-center text-[13px] text-[var(--landing-muted)]">
          Prices in PKR. Need a custom security review or volume contract?{" "}
          <Link
            href="/register?plan=custom"
            className="font-medium text-[var(--landing-ink)] underline-offset-2 hover:underline"
          >
            Contact us
          </Link>
          .
        </p>
        </LandingReveal>
      </div>
    </section>
  );
}
