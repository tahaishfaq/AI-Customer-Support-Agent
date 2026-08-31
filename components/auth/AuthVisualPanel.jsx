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

/** Marketing panel stays light even when the app shell is dark. */
export function AuthVisualPanel() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden lg:block">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, #0d7377 38%, transparent), transparent 70%), linear-gradient(180deg, #d7e8e5 0%, #c5ddd9 45%, #dceae7 100%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-center px-12 xl:px-16">
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-[#0d7377]">
          Aide workspace
        </p>
        <h2 className="mt-3 max-w-md font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight tracking-tight text-[#0f172a]">
          Support that learns from every conversation
        </h2>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#334155]">
          Build agents, chat with customers, and turn messages into clear
          business insights.
        </p>

        <ul className="mt-10 flex flex-col gap-4">
          {HIGHLIGHTS.map((item, index) => (
            <li
              key={item.title}
              className="rounded-2xl border border-[#e2e8f0] bg-white/90 p-4 shadow-sm backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0d7377]/10 text-sm font-semibold text-[#0d7377]">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-[#0f172a]">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#475569]">
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
