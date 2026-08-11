const HIGHLIGHTS = [
  {
    title: "AI support agents",
    body: "Create agents with your own knowledge and welcome flow.",
  },
  {
    title: "Live conversations",
    body: "Every chat is stored with response time and context.",
  },
  {
    title: "Customer insights",
    body: "See sentiment, topics, and trends in one dashboard.",
  },
];

export function AuthVisualPanel() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden lg:block">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--color-primary) 38%, transparent), transparent 70%), linear-gradient(180deg, #d7e8e5 0%, #c5ddd9 45%, #dceae7 100%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-center px-12 xl:px-16">
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-[var(--color-primary)]">
          Hapy workspace
        </p>
        <h2 className="mt-3 max-w-md font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)]">
          Support that learns from every conversation
        </h2>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Build agents, chat with customers, and turn messages into clear
          business insights.
        </p>

        <ul className="mt-10 space-y-4">
          {HIGHLIGHTS.map((item, index) => (
            <li
              key={item.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 p-4 shadow-sm backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-[var(--color-text)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {item.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
