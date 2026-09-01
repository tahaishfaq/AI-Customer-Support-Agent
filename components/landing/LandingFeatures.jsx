import {
  Check,
} from "lucide-react";
import { FeatureLiveChat } from "@/components/landing/FeatureLiveChat";
import { FeatureLiveActions } from "@/components/landing/FeatureLiveActions";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSectionIntro } from "@/components/landing/LandingSectionIntro";

const SCENE =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=80";

const FEATURES = [
  {
    eyebrow: "Customer support",
    title: "Resolve tickets, automatically.",
    body: "Agents triage, draft, and close conversations the moment they land — pulling from your knowledge base and tools to answer with full context.",
    points: [
      "Embed chat on your site or app",
      "Knowledge-grounded replies with citations",
      "Hand-off to humans with full context",
    ],
    visual: "support",
  },
  {
    eyebrow: "Knowledge & actions",
    title: "Teach once. Act safely.",
    body: "Replace brittle macros and one-off scripts with knowledge plus allowlisted actions that branch, confirm, and recover — configured in minutes.",
    points: [
      "FAQ and PDF knowledge retrieve",
      "Owner-configured HTTP tools",
      "Confirm and identity gates for write actions",
    ],
    visual: "actions",
  },
  {
    eyebrow: "Data & insights",
    title: "See what your agents do.",
    body: "Every conversation, action, and outcome becomes structured signal. Track resolution, topics, and where to improve — in one dashboard.",
    points: [
      "Real-time sentiment and topic trends",
      "Conversation history you own",
      "Studio test before you go live",
    ],
    visual: "insights",
  },
];

function InsightsMock() {
  const stats = [
    { label: "Sentiment", value: "71% +" },
    { label: "Top topic", value: "Shipping" },
    { label: "Avg reply", value: "2.3s" },
    { label: "Handoffs", value: "12 today" },
  ];

  return (
    <div className="grid w-full max-w-[19.5rem] grid-cols-2 gap-2.5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-white/70 bg-white/95 px-3.5 py-3.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--landing-muted)] uppercase">
            {stat.label}
          </p>
          <p className="mt-2 text-[15px] font-semibold tracking-tight text-[var(--landing-ink)]">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function FeatureVisual({ type }) {
  return (
    <div className="relative min-h-[17rem] overflow-hidden sm:min-h-[20rem] lg:min-h-[22rem]">
      <img
        src={SCENE}
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-transparent to-black/35" />
      <div className="relative flex h-full min-h-[17rem] items-center justify-center p-6 sm:min-h-[20rem] sm:p-8 lg:min-h-[22rem]">
        {type === "actions" ? (
          <FeatureLiveActions />
        ) : type === "insights" ? (
          <InsightsMock />
        ) : (
          <FeatureLiveChat />
        )}
      </div>
    </div>
  );
}

function FeatureCopy({ feature }) {
  return (
    <div className="flex h-full flex-col justify-center bg-[#f3f1ee] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--landing-muted)] uppercase">
        {feature.eyebrow}
      </p>
      <h3 className="landing-display mt-3 max-w-[18ch] text-[1.65rem] leading-[1.2] text-[var(--landing-ink)] sm:text-[1.9rem] lg:text-[2.05rem]">
        {feature.title}
      </h3>
      <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[var(--landing-muted)] sm:text-[15px]">
        {feature.body}
      </p>
      <ul className="mt-7 space-y-3.5">
        {feature.points.map((point) => (
          <li
            key={point}
            className="flex items-start gap-3 text-[13px] leading-snug text-[var(--landing-ink)] sm:text-[14px]"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
              <Check className="size-3 stroke-[3]" />
            </span>
            <span className="min-w-0">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="scroll-mt-24 bg-white px-6 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <LandingSectionIntro
          eyebrow="Features"
          title="AI support platform that works for you."
          description="Purpose-built capabilities that eliminate manual work across your support operation."
          titleClassName="mt-4 text-[2rem] leading-[1.15] sm:text-4xl md:text-[2.85rem]"
        />

        <div className="relative mt-14 sm:mt-16">
          {FEATURES.map((feature, index) => {
            const reversed = index % 2 === 1;
            const top = `calc(5.5rem + ${index * 1.25}rem)`;

            return (
              <LandingReveal
                key={feature.title}
                delay={index * 35}
                className="landing-feature-sticky sticky mb-5 sm:mb-6"
                style={{ top, zIndex: index + 1 }}
              >
                <article className="landing-feature-card overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-[#f3f1ee] shadow-[0_28px_70px_-32px_rgba(20,16,12,0.42)]">
                  <div
                    className={`grid lg:grid-cols-2 ${
                      reversed ? "lg:[&>*:first-child]:order-2" : ""
                    }`}
                  >
                    <FeatureCopy feature={feature} />
                    <FeatureVisual type={feature.visual} />
                  </div>
                </article>
              </LandingReveal>
            );
          })}
        </div>

        <div className="h-20 sm:h-28" aria-hidden />
      </div>
    </section>
  );
}
