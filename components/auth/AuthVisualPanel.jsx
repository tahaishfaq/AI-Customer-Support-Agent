import { Star } from "lucide-react";
import { AideLogo } from "@/components/brand/AideLogo";

const HIGHLIGHTS = [
  {
    title: "Agents that ship",
    body: "Knowledge, tools, and embed — ready in one workspace.",
  },
  {
    title: "Conversations you own",
    body: "Every chat stored with context for the desk and analytics.",
  },
  {
    title: "Insights that compound",
    body: "See topics, resolution, and where to improve next.",
  },
];

/** Brand panel — grid + glow, matches landing footer language. */
export function AuthVisualPanel() {
  return (
    <aside className="relative hidden min-h-dvh overflow-hidden bg-[#0b0b0b] text-white lg:flex lg:flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 20%, #000 20%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-8%] h-[50%] w-[min(40rem,110%)] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in oklch, var(--color-primary) 38%, transparent) 0%, color-mix(in oklch, var(--color-primary) 12%, transparent) 42%, transparent 72%)",
          filter: "blur(8px)",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col justify-between px-10 py-12 xl:px-14 xl:py-14">
        <AideLogo href="/" size="md" variant="light" />

        <div className="max-w-md">
          <p className="text-[12px] font-medium tracking-[0.14em] text-white/45 uppercase">
            [ AIDE ]
          </p>
          <h2 className="landing-display mt-4 text-[2.15rem] leading-[1.15] tracking-tight xl:text-[2.45rem]">
            Support that turns into a system.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            Build grounded agents, hand off with context, and measure what
            actually resolves.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" />
                <div>
                  <p className="text-[14px] font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="size-3.5 fill-[var(--color-primary)] text-[var(--color-primary)]"
              />
            ))}
            <span className="ml-1 text-[13px] font-medium text-white/85">
              4.9 average satisfaction
            </span>
          </div>
          <p className="text-[13px] text-white/50">
            Trusted by teams who value structure.
          </p>
        </div>
      </div>
    </aside>
  );
}
