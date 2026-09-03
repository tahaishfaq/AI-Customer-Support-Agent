import { Quote, Star } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { cn } from "@/lib/utils";

const AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=96&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=96&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=96&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=96&q=80",
];

const COLUMN_A = [
  {
    rating: "4.9",
    quote:
      "AIDE helped us cut average ticket wait from hours to minutes — while our team spends time on conversations that need a human.",
    name: "Marcus Lee",
    role: "COO",
    image: AVATARS[0],
  },
  {
    rating: "5.0",
    quote:
      "We replaced a patchwork of macros and scripts with one AIDE agent. Ops finally has one source of truth.",
    name: "Priya Shah",
    role: "Founder",
    image: AVATARS[1],
  },
  {
    rating: "4.9",
    quote:
      "Studio testing plus knowledge citations made us confident to embed on day one.",
    name: "Jesse Leigh",
    role: "CEO & Founder",
    image: AVATARS[2],
  },
];

const COLUMN_B = [
  {
    rating: "5.0",
    quote:
      "Set up in an afternoon, live by Friday. Six months in, the agent handles most inbound — and the desk isn’t burned out.",
    name: "Ethan Walker",
    role: "Head of Support",
    image: AVATARS[3],
  },
  {
    rating: "4.9",
    quote:
      "AIDE turned scattered support tools into a system we can measure, improve, and trust.",
    name: "Sofia Ramirez",
    role: "Product Lead",
    image: AVATARS[4],
  },
  {
    rating: "5.0",
    quote:
      "Insights showed gaps we had never reported. The desk finally sees what’s actually happening.",
    name: "Daniel Mercer",
    role: "Head of Operations",
    image: AVATARS[1],
  },
];

function ReviewCard({ card }) {
  return (
    <article className="landing-dot-frame flex flex-col bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <Quote
          className="size-5 text-muted-foreground/50"
          strokeWidth={1.5}
          aria-hidden
        />
        <div className="flex items-center gap-1 text-[12px] font-semibold tabular-nums text-foreground">
          {card.rating}
          <Star className="size-3 fill-[var(--color-primary)] text-[var(--color-primary)]" />
        </div>
      </div>

      <p className="mt-4 flex-1 text-[14px] leading-relaxed text-foreground sm:text-[15px]">
        “{card.quote}”
      </p>

      <div className="mt-6 flex items-center gap-3">
        <img
          src={card.image}
          alt=""
          className="size-9 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {card.name}
          </p>
          <p className="text-[11px] text-muted-foreground">{card.role}</p>
        </div>
      </div>
    </article>
  );
}

function VerticalMarquee({ cards, direction = "up", duration = "42s" }) {
  const loop = [...cards, ...cards];

  return (
    <div className="landing-reviews-col relative h-[28rem] overflow-hidden sm:h-[32rem] lg:h-[34rem]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-[var(--landing-panel)] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[var(--landing-panel)] to-transparent"
      />
      <div
        className={cn(
          "landing-reviews-v-marquee flex flex-col gap-4",
          direction === "down"
            ? "landing-reviews-v-marquee--down"
            : "landing-reviews-v-marquee--up"
        )}
        style={{ animationDuration: duration }}
      >
        {loop.map((card, i) => (
          <ReviewCard key={`${card.name}-${i}`} card={card} />
        ))}
      </div>
    </div>
  );
}

export function LandingReviews() {
  return (
    <section
      id="reviews"
      className="landing-section landing-section-grid bg-[var(--landing-panel)]"
    >
      <div className="landing-dot-b grid gap-6 px-5 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:gap-10 lg:px-8">
        <LandingReveal fadeOnly>
          <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
            Reviews
          </p>
          <h2 className="landing-display mt-3 max-w-xl text-3xl text-foreground sm:text-4xl md:text-[2.65rem] md:leading-[1.12]">
            Trusted by teams who value{" "}
            <span className="text-muted-foreground">structure</span>.
          </h2>
        </LandingReveal>
        <LandingReveal fadeOnly delay={40} />
      </div>

      <div className="grid gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-6 lg:px-8 lg:py-12">
        <LandingReveal fadeOnly delay={60}>
          <aside className="landing-dot-frame relative flex h-full min-h-[28rem] flex-col overflow-hidden bg-[var(--landing-ink)] p-6 text-white sm:min-h-[32rem] sm:p-8 lg:min-h-[34rem]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.35) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[var(--color-primary)]/35 blur-3xl"
            />

            <div className="relative z-10">
              <p className="landing-display text-[2.75rem] leading-none tracking-tight sm:text-[3.25rem]">
                4.9
                <span className="text-[1.35rem] text-white/50">/5</span>
              </p>
              <p className="mt-3 font-mono text-[11px] tracking-[0.08em] text-white/55 uppercase">
                Average client satisfaction
              </p>
            </div>

            <div className="relative z-10 mt-auto space-y-5 pt-16">
              <div className="flex items-center">
                {AVATARS.map((src, i) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className={cn(
                      "size-9 rounded-full border-2 border-[var(--landing-ink)] object-cover",
                      i > 0 && "-ml-2.5"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3.5 fill-[var(--color-primary)] text-[var(--color-primary)]"
                  />
                ))}
                <span className="ml-1 text-[13px] font-medium text-white/85">
                  200+ teams trust us
                </span>
              </div>

              <p className="text-[14px] leading-relaxed text-white/65">
                Over 200 teams rely on AIDE for grounded support agents.
              </p>
            </div>
          </aside>
        </LandingReveal>

        <LandingReveal fadeOnly delay={90} className="min-w-0">
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
            <VerticalMarquee cards={COLUMN_A} direction="up" duration="40s" />
            <VerticalMarquee
              cards={COLUMN_B}
              direction="down"
              duration="46s"
            />
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
