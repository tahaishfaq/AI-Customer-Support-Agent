import { MessagesSquare, Shield, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Knowledge-grounded answers",
    body: "Agents reply from your FAQs and PDFs — and stay in the knowledge language you trained.",
  },
  {
    icon: MessagesSquare,
    title: "Chat + conversation history",
    body: "Test in the widget, resume old threads, and keep an inbox of every customer chat.",
  },
  {
    icon: Shield,
    title: "Workspace you own",
    body: "One Hapy account for agents, knowledge, chat, and insights — simple enough to ship fast.",
  },
];

export function LandingFeatures() {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--color-primary) 10%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
            Why Hapy
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
            Support that learns from every conversation.
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Focused product surface — not a bloated marketplace.
          </p>
        </div>

        <ul className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title}>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {feature.body}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
