import Link from "next/link";
import { ArrowUpRight, Link2, Settings2, Zap } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";

const STEPS = [
  {
    title: "Connect",
    body: "Add FAQs and documents so your agent answers from your knowledge — not invents policy.",
    detail: "Knowledge base",
    icon: Link2,
  },
  {
    title: "Configure",
    body: "Set tone, tools, and handoff rules in the studio. Test as a visitor before you embed.",
    detail: "Studio setup",
    icon: Settings2,
  },
  {
    title: "Go live",
    body: "Drop the widget on your site, watch conversations, and claim handoffs from the human desk.",
    detail: "Embed & desk",
    icon: Zap,
  },
];

export function LandingHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-y border-black/5 bg-[var(--landing-panel)] px-6 py-20 sm:px-8 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12 xl:gap-16">
        <aside className="landing-how-sticky lg:sticky lg:top-28 lg:self-start">
          <LandingReveal fadeOnly>
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
              How it works
            </p>
            <h2 className="landing-display mt-3 text-3xl text-[var(--landing-ink)] sm:text-4xl md:text-[2.65rem] md:leading-[1.15]">
              Get started in three simple steps.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--landing-muted)]">
              Most teams ship their first production agent in days — not months.
              No engineering review required.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--landing-ink)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get started
              <ArrowUpRight className="size-4" />
            </Link>
          </LandingReveal>
        </aside>

        <ol className="landing-how-steps relative space-y-4 sm:space-y-5">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const top = `calc(7rem + ${index * 0.75}rem)`;

            return (
              <li
                key={step.title}
                className="landing-how-card sticky"
                style={{ top, zIndex: index + 1 }}
              >
                <article className="rounded-[1.5rem] border border-black/[0.06] bg-white p-6 shadow-[0_16px_40px_-24px_rgba(20,16,12,0.35)] sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      <Icon className="size-5" />
                    </span>
                    <span className="text-[13px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
                      Step 0{index + 1}
                    </span>
                  </div>

                  <p className="mt-6 text-[11px] font-semibold tracking-[0.14em] text-[var(--landing-muted)] uppercase">
                    {step.detail}
                  </p>
                  <h3 className="landing-display mt-2 text-[1.75rem] text-[var(--landing-ink)] sm:text-[2rem]">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--landing-muted)]">
                    {step.body}
                  </p>

                  <div className="mt-7 h-px bg-black/[0.06]" />
                  <div className="mt-5 flex items-center gap-2">
                    {STEPS.map((_, i) => (
                      <span
                        key={STEPS[i].title}
                        className={`h-1.5 rounded-full ${
                          i <= index
                            ? "w-6 bg-[var(--color-primary)]"
                            : "w-1.5 bg-black/10"
                        }`}
                      />
                    ))}
                    <span className="ml-auto text-[12px] text-[var(--landing-muted)]">
                      {index + 1} of {STEPS.length}
                    </span>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
