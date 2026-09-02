import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function LandingCTA() {
  return (
    <section className="px-6 pb-16 pt-4 sm:px-8 sm:pb-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[1.75rem] border border-black/[0.06]">
        <div
          aria-hidden
          className="landing-cta-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
        >
          <span className="landing-cta-base" />
          <span className="landing-cta-orb landing-cta-orb-a" />
          <span className="landing-cta-orb landing-cta-orb-b" />
          <span className="landing-cta-sheen" />
        </div>

        <div className="relative z-10 px-8 py-16 text-center sm:px-12 sm:py-20 lg:px-16 lg:py-24">
          <LandingReveal>
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-3.5 py-1.5 backdrop-blur-sm">
            <span
              aria-hidden
              className="h-3 w-1 rounded-full bg-[var(--color-primary)]"
            />
            <span className="text-[11px] font-semibold tracking-[0.14em] text-[var(--landing-ink)] uppercase">
              Ready when you are
            </span>
          </div>
          </LandingReveal>

          <LandingReveal delay={25}>
          <h2 className="landing-display mx-auto mt-6 max-w-3xl text-[2rem] leading-[1.15] text-[var(--landing-ink)] sm:text-4xl md:text-[2.85rem]">
            Deploy support agents that work for you, 24/7.
          </h2>
          </LandingReveal>

          <LandingReveal delay={50}>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--landing-muted)] sm:text-base">
            Create a workspace, add knowledge, and start chatting in minutes —
            then embed when you’re ready.
          </p>
          </LandingReveal>

          <LandingReveal delay={75}>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[var(--landing-ink)] px-7 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get started
              <ArrowUpRight className="size-4" />
            </Link>
            <a
              href="#plans"
              className="inline-flex h-12 items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-7 text-sm font-medium text-[var(--landing-ink)] backdrop-blur-sm transition-colors hover:bg-white"
            >
              Talk to sales
              <ArrowUpRight className="size-4" />
            </a>
          </div>
          </LandingReveal>

          <LandingReveal delay={100}>
          <p className="mt-8 text-[12px] text-[var(--landing-muted)]">
            Free to start · Popular from Rs 3,500 / mo · No flow canvas required
          </p>
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-black/5 bg-white px-6 py-12 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[17px] font-semibold tracking-tight text-[var(--landing-ink)]">
            Aide
          </p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--landing-muted)]">
            AI customer support agents with knowledge, tools, human desk, and
            insights.
          </p>
        </div>
        <div>
          <p className="text-[12px] font-semibold tracking-[0.12em] text-[var(--landing-muted)] uppercase">
            Navigation
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--landing-ink)]">
            <li>
              <a href="#features" className="hover:text-[var(--color-primary)]">
                Features
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                className="hover:text-[var(--color-primary)]"
              >
                How it works
              </a>
            </li>
            <li>
              <a href="#plans" className="hover:text-[var(--color-primary)]">
                Plans
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-[var(--color-primary)]">
                FAQ
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[12px] font-semibold tracking-[0.12em] text-[var(--landing-muted)] uppercase">
            Account
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--landing-ink)]">
            <li>
              <Link href="/login" className="hover:text-[var(--color-primary)]">
                Sign in
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="hover:text-[var(--color-primary)]"
              >
                Get started
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[12px] font-semibold tracking-[0.12em] text-[var(--landing-muted)] uppercase">
            Product
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">
            Built for support teams who want agents that stay grounded, safe,
            and measurable.
          </p>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-black/5 pt-6 text-[13px] text-[var(--landing-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Aide.</p>
        <p>AI Customer Support & Insights</p>
      </div>
    </footer>
  );
}
