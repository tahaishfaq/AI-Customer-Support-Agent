"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingReveal } from "@/components/landing/LandingReveal";

const FAQS = [
  {
    q: "How quickly can we deploy an AIDE agent?",
    a: "Most teams connect knowledge, test in Studio, and embed the widget within a few days. No flow canvas required — configure, test, go live.",
  },
  {
    q: "What can the agent use besides knowledge?",
    a: "Owners can enable allowlisted HTTP tools and built-in handoff. Write actions can require end-user confirm or login. MCP catalog UX is rolling out next.",
  },
  {
    q: "How does pricing work?",
    a: "Basic and Popular are available after signup. Teams (multi-seat) is coming soon. Custom is contact-only for enterprise volume.",
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
    a: "Yes. Move between Basic and Popular as you grow. Teams is coming soon; request Custom for tailored limits.",
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState(0);

  return (
    <section
      id="faq"
      className="landing-section landing-section-grid overflow-x-clip bg-white"
    >
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <div className="landing-dot-b landing-dot-b-lg-none landing-dot-r-lg px-5 py-8 sm:px-6 sm:py-10 lg:px-8">
          <LandingReveal>
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
              FAQ
            </p>
          </LandingReveal>
          <LandingReveal delay={40}>
            <h2 className="landing-display mt-3 max-w-xl text-3xl text-[var(--landing-ink)] sm:text-4xl md:text-[2.65rem] md:leading-[1.12]">
              Clear answers before
              <br />
              you{" "}
              <span className="text-[var(--landing-muted)]">start</span>.
            </h2>
          </LandingReveal>
          <LandingReveal delay={80}>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--landing-muted)] sm:text-base">
              Everything teams ask before getting started. Still curious? Reach
              out — we usually reply within a business day.
            </p>
          </LandingReveal>
        </div>

        <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {FAQS.map((item, index) => {
            const isOpen = open === index;

            return (
              <div
                key={item.q}
                className={cn(
                  "landing-dot-b overflow-hidden transition-colors duration-300 last:border-b-0",
                  isOpen
                    ? "bg-white"
                    : "bg-transparent hover:bg-[var(--landing-panel)]/60"
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(index)}
                  className="flex h-[4.75rem] w-full items-center justify-between gap-4 px-3 text-left sm:h-[5rem] sm:px-4"
                >
                  <span className="flex min-w-0 items-start gap-3">
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
                      "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
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

                {isOpen ? (
                  <div className="h-[5.75rem] overflow-hidden px-3 pb-5 sm:h-[6rem] sm:px-4 sm:pb-6 sm:pl-[3.5rem]">
                    <p className="max-w-xl text-[14px] leading-relaxed text-[var(--landing-muted)]">
                      {item.a}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
