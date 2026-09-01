"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingReveal } from "@/components/landing/LandingReveal";

const FAQS = [
  {
    q: "How quickly can we deploy an Aide agent?",
    a: "Most teams connect knowledge, test in Studio, and embed the widget within a few days. No flow canvas required — configure, test, go live.",
  },
  {
    q: "What can the agent use besides knowledge?",
    a: "Owners can enable allowlisted HTTP tools and built-in handoff. Write actions can require end-user confirm or login. MCP catalog UX is rolling out next.",
  },
  {
    q: "How does pricing work?",
    a: "Four plan slots: Free, Popular (Rs 3,500 / mo PKR), Teams (Rs 7,500 / mo PKR), and Custom (contact). Choose a plan after signup when checkout is enabled.",
  },
  {
    q: "How is our data secured?",
    a: "Workspace isolation, server-side secrets, and policy checks outside the LLM. Confirmation and identity gates stay deterministic — the model is never the PEP.",
  },
  {
    q: "Can we hand off to a human?",
    a: "Yes. Visitors can request a human; agents can call request_handoff. Your team claims threads from the Human desk with full conversation context.",
  },
  {
    q: "Can we cancel or change plans later?",
    a: "Yes. Move between Free / Popular / Teams as you grow, or request Custom for tailored limits. Billing lifecycle ships with SafePay checkout.",
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState(0);

  return (
    <section
      id="faq"
      className="scroll-mt-24 overflow-x-hidden bg-white px-6 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <LandingReveal>
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
              FAQs
            </p>
          </LandingReveal>
          <LandingReveal delay={40}>
            <h2 className="landing-display mt-3 text-3xl text-[var(--landing-ink)] sm:text-4xl">
              Questions?
            </h2>
          </LandingReveal>
          <LandingReveal delay={80}>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--landing-muted)]">
              Everything teams ask before getting started. Still curious? Reach
              out — we usually reply within a business day.
            </p>
          </LandingReveal>

          <LandingReveal delay={120}>
          <div className="mt-8 overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-[#f3f1ee] p-6">
            <p className="landing-display text-xl text-[var(--landing-ink)]">
              Still need a human?
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--landing-muted)]">
              Talk through volume, security, or a Custom plan with the Aide
              team.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/register?plan=custom"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--landing-ink)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Contact us
                <ArrowUpRight className="size-3.5" />
              </Link>
              <a
                href="#plans"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-[var(--landing-ink)] transition-colors hover:border-black/20"
              >
                View plans
              </a>
            </div>
          </div>
          </LandingReveal>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, index) => {
            const isOpen = open === index;

            return (
              <LandingReveal key={item.q} delay={index * 30}>
              <div
                className={cn(
                  "overflow-hidden rounded-[1.25rem] border transition-all duration-300",
                  isOpen
                    ? "border-[var(--color-primary)]/25 bg-white shadow-[0_20px_50px_-28px_rgba(20,16,12,0.35)]"
                    : "border-black/[0.06] bg-[#faf9f7] hover:border-black/10 hover:bg-white"
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : index)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 text-[12px] font-semibold tracking-[0.08em] tabular-nums",
                        isOpen
                          ? "text-[var(--color-primary)]"
                          : "text-[var(--landing-muted)]"
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15px] font-medium leading-snug text-[var(--landing-ink)] sm:text-base">
                      {item.q}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                      isOpen
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-black/[0.04] text-[var(--landing-muted)]"
                    )}
                  >
                    {isOpen ? (
                      <Minus className="size-4" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                  </span>
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-xl px-5 pb-5 text-[14px] leading-relaxed text-[var(--landing-muted)] sm:px-6 sm:pb-6 sm:pl-[3.75rem]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
              </LandingReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
