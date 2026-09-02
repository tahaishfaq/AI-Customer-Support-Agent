import { Star } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSectionIntro } from "@/components/landing/LandingSectionIntro";

const FEATURED = {
  quote:
    "Aide helped us cut average ticket wait from hours to minutes — while our team spends time on the conversations that actually need a human.",
  name: "Daniel Carter",
  role: "Platform Engineer",
  image:
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1200&q=80",
};

const CARDS = [
  {
    rating: "5.0",
    quote:
      "We replaced a patchwork of macros and scripts with one Aide agent. Ops finally has one source of truth.",
    name: "Priya Shah",
    role: "Founder",
    initials: "PS",
    social: "in",
  },
  {
    rating: "5.0",
    quote:
      "Studio testing plus knowledge citations made us confident to embed on day one. Insights showed gaps we had never reported.",
    name: "Jesse Leigh",
    role: "CEO & Founder",
    initials: "JL",
    social: "x",
  },
  {
    rating: "5.0",
    quote:
      "Set up in an afternoon, live by Friday. Six months in, the agent handles most inbound — and the desk isn’t burned out.",
    name: "Ethan Walker",
    role: "Head of Support",
    initials: "EW",
    social: "x",
  },
];

function SocialMark({ type }) {
  if (type === "in") {
    return (
      <span className="text-[10px] font-bold tracking-tight text-[var(--landing-ink)]">
        in
      </span>
    );
  }
  return (
    <span className="text-[12px] font-semibold text-[var(--landing-ink)]">𝕏</span>
  );
}

function ReviewCard({ card }) {
  return (
    <article className="landing-reviews-card flex h-full flex-col rounded-[1.35rem] border border-black/[0.05] bg-[#f3f1ee] p-6 sm:p-7">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--color-primary)] uppercase">
        {card.rating}
        <Star className="size-3 fill-[var(--color-primary)] text-[var(--color-primary)]" />
        Rating
      </div>
      <p className="landing-display mt-5 flex-1 text-[1.1rem] leading-snug text-[var(--landing-ink)] sm:text-[1.2rem]">
        “{card.quote}”
      </p>
      <div className="mt-8 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[var(--landing-ink)]">
            {card.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--landing-ink)]">
              {card.name}
            </p>
            <p className="text-[10px] font-medium tracking-[0.1em] text-[var(--landing-muted)] uppercase">
              {card.role}
            </p>
          </div>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white">
          <SocialMark type={card.social} />
        </span>
      </div>
    </article>
  );
}

export function LandingReviews() {
  const loop = [...CARDS, ...CARDS];

  return (
    <section className="bg-[var(--landing-panel)] px-6 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <LandingSectionIntro
          eyebrow="Reviews"
          eyebrowClassName="text-[var(--color-primary)]"
          title="Trusted by modern teams"
          description="From early startups to multi-brand workspaces — here’s what teams say after shipping with Aide."
        />

        <LandingReveal delay={50}>
          <figure className="mt-12 overflow-hidden rounded-[1.5rem] border border-black/[0.05] bg-[#efece7] sm:mt-14 lg:grid lg:grid-cols-2">
          <div className="relative min-h-[18rem] sm:min-h-[22rem] lg:min-h-[26rem]">
            <img
              src={FEATURED.image}
              alt=""
              className="absolute inset-0 size-full object-cover object-[center_20%]"
            />
          </div>
          <figcaption className="flex flex-col justify-between px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <blockquote className="landing-display text-[1.35rem] leading-[1.3] text-[var(--landing-ink)] sm:text-[1.65rem] lg:text-[1.85rem]">
              “{FEATURED.quote}”
            </blockquote>
            <div className="mt-10 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--landing-ink)]">
                  {FEATURED.name}
                </p>
                <p className="mt-1 text-[11px] font-medium tracking-[0.12em] text-[var(--landing-muted)] uppercase">
                  {FEATURED.role}
                </p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-[13px] font-semibold text-[var(--landing-ink)]">
                𝕏
              </span>
            </div>
          </figcaption>
        </figure>
        </LandingReveal>

        <LandingReveal delay={90}>
        {/* Same width carousel — card size matches 3-col grid */}
        <div className="landing-reviews-viewport relative mt-5 overflow-hidden sm:mt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[var(--landing-panel)] to-transparent sm:w-10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[var(--landing-panel)] to-transparent sm:w-10"
          />
          <div className="landing-reviews-marquee flex w-max gap-4 lg:gap-5">
            {loop.map((card, i) => (
              <ReviewCard key={`${card.name}-${i}`} card={card} />
            ))}
          </div>
        </div>
        </LandingReveal>
      </div>
    </section>
  );
}
