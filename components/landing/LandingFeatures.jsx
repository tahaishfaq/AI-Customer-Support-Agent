import { BarChart3, Bot, Workflow } from "lucide-react";
import { FeatureLiveChat } from "@/components/landing/FeatureLiveChat";
import { FeatureLiveActions } from "@/components/landing/FeatureLiveActions";
import { FeatureLiveInsights } from "@/components/landing/FeatureLiveInsights";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    index: "01",
    eyebrow: "Customer support",
    title: "Resolve tickets, automatically.",
    body: "Agents triage, draft, and close conversations the moment they land — grounded in your knowledge and tools.",
    points: [
      "Embed chat on your site or app",
      "Replies with citations",
      "Hand-off with full context",
    ],
    visual: "support",
    icon: Bot,
  },
  {
    index: "02",
    eyebrow: "Knowledge & actions",
    title: "Teach once. Act safely.",
    body: "Replace brittle macros with knowledge plus allowlisted actions that confirm, branch, and recover.",
    points: [
      "FAQ and PDF retrieve",
      "Owner-configured HTTP tools",
      "Confirm gates for write actions",
    ],
    visual: "actions",
    icon: Workflow,
  },
  {
    index: "03",
    eyebrow: "Data & insights",
    title: "See what your agents do.",
    body: "Every conversation becomes structured signal — resolution, topics, and where to improve.",
    points: [
      "Sentiment and topic trends",
      "Conversation history you own",
      "Studio test before go-live",
    ],
    visual: "insights",
    icon: BarChart3,
    dark: true,
  },
];

function FeatureVisual({ type, dark }) {
  const isInsights = type === "insights";
  const isChat = type === "support";

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center",
        isInsights
          ? "min-h-[18rem] p-4 sm:min-h-[20rem] sm:p-6 lg:p-8"
          : isChat
            ? "h-[24rem] p-6 sm:h-[26rem] sm:p-8"
            : "min-h-[13rem] p-6 sm:min-h-[15rem] sm:p-8",
        dark && "text-white"
      )}
    >
      {type === "actions" ? (
        <FeatureLiveActions />
      ) : type === "insights" ? (
        <FeatureLiveInsights />
      ) : (
        <FeatureLiveChat />
      )}
    </div>
  );
}

function FeatureCopy({ feature }) {
  const Icon = feature.icon;
  const dark = feature.dark;

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            dark
              ? "bg-white/10 text-white"
              : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <span
          className={cn(
            "text-[11px] font-semibold tracking-[0.14em] uppercase",
            dark ? "text-white/60" : "text-[var(--landing-muted)]"
          )}
        >
          {feature.eyebrow}
        </span>
      </div>

      <p className="mt-6 text-[12px] font-semibold tracking-[0.2em] text-[var(--color-primary)]">
        {feature.index}
      </p>

      <h3
        className={cn(
          "landing-display mt-3 text-[1.75rem] leading-[1.2] sm:text-[2rem]",
          dark ? "text-white" : "text-[var(--landing-ink)]"
        )}
      >
        {feature.title}
      </h3>
      <p
        className={cn(
          "mt-4 max-w-md text-[15px] leading-relaxed",
          dark ? "text-white/70" : "text-[var(--landing-muted)]"
        )}
      >
        {feature.body}
      </p>

      <ul className="mt-6 space-y-2.5">
        {feature.points.map((point) => (
          <li
            key={point}
            className={cn(
              "flex items-start gap-2.5 text-[14px] leading-snug",
              dark ? "text-white/90" : "text-[var(--landing-ink)]"
            )}
          >
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DarkPanelBackdrop() {
  return (
    <>
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
    </>
  );
}

function GridCell({ children, className, dark = false }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden px-6 py-10 sm:px-8 sm:py-12 lg:px-10",
        dark ? "landing-dot-cell-dark" : "landing-dot-cell",
        className
      )}
    >
      {dark ? <DarkPanelBackdrop /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function LandingFeatures() {
  const [f1, f2, f3] = FEATURES;

  return (
    <section
      id="features"
      className="landing-section landing-section-grid bg-white py-0"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Intro — full width */}
          <GridCell className="col-span-1 lg:col-span-2">
            <LandingReveal fadeOnly className="max-w-2xl">
              <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
                Features
              </p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--landing-muted)] sm:text-base">
                Three core capabilities — chat, actions, and insights — built to
                work together from day one.
              </p>
            </LandingReveal>
          </GridCell>

          {/* 01 — copy | visual */}
          <GridCell className="landing-dot-r-lg">
            <LandingReveal fadeOnly delay={60}>
              <FeatureCopy feature={f1} />
            </LandingReveal>
          </GridCell>
          <GridCell className="bg-[#f7f5f2]">
            <LandingReveal fadeOnly delay={80}>
              <FeatureVisual type={f1.visual} />
            </LandingReveal>
          </GridCell>

          {/* 02 — visual | copy */}
          <GridCell className="order-4 bg-[#f7f5f2] lg:order-none landing-dot-r-lg">
            <LandingReveal fadeOnly delay={100}>
              <FeatureVisual type={f2.visual} />
            </LandingReveal>
          </GridCell>
          <GridCell className="order-3 lg:order-none">
            <LandingReveal fadeOnly delay={120}>
              <FeatureCopy feature={f2} />
            </LandingReveal>
          </GridCell>

          {/* 03 — copy | visual (dark) */}
          <GridCell dark className="bg-[var(--landing-ink)] landing-dot-cell-none-lg landing-dot-r-lg-light">
            <LandingReveal fadeOnly delay={140}>
              <FeatureCopy feature={f3} />
            </LandingReveal>
          </GridCell>
          <GridCell
            dark
            className="landing-dot-cell-none bg-[var(--landing-ink)]"
          >
            <LandingReveal fadeOnly delay={160}>
              <FeatureVisual type={f3.visual} dark />
            </LandingReveal>
          </GridCell>
      </div>
    </section>
  );
}
