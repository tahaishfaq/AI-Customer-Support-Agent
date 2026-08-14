import { Bot, BookOpen, LineChart, MessageSquare } from "lucide-react";

const STEPS = [
  {
    num: "01",
    title: "Build",
    body: "Create an agent with a name, welcome message, and system prompt.",
    icon: Bot,
  },
  {
    num: "02",
    title: "Teach",
    body: "Add FAQ text or PDFs so the agent answers from your knowledge.",
    icon: BookOpen,
  },
  {
    num: "03",
    title: "Chat",
    body: "Talk in the widget, resume old threads, and keep every message.",
    icon: MessageSquare,
  },
  {
    num: "04",
    title: "Learn",
    body: "See sentiment, topics, and response time across conversations.",
    icon: LineChart,
  },
];

export function LandingHowItWorks() {
  return (
    <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
            How it works
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
            From agent to insight — one workspace.
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Four clear steps. No canvas, no clutter.
          </p>
        </div>

        <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.num} className="relative">
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-5 left-[3.25rem] hidden h-px w-[calc(100%-1rem)] bg-[var(--color-border)] lg:block"
                  />
                ) : null}
                <div className="relative flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white shadow-[0_10px_24px_-12px_rgba(11,95,88,0.7)]">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-primary)]">
                    {step.num}
                  </span>
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
