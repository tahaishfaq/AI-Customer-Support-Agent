const STEPS = [
  {
    title: "Create an agent",
    body: "Give your AI a name, welcome message, and knowledge.",
  },
  {
    title: "Chat with customers",
    body: "Answer questions using your docs — every message is stored.",
  },
  {
    title: "See insights",
    body: "Track sentiment, topics, and response performance.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">
          How it works
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--color-text-secondary)]">
          Three steps from idea to customer insight.
        </p>
        <ol className="mt-12 grid gap-10 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <p className="text-sm font-medium text-[var(--color-primary)]">
                Step {index + 1}
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-text)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
