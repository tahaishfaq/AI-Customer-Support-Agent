import Link from "next/link";

export default function AuthLayout({ children }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            linear-gradient(
              125deg,
              color-mix(in oklch, var(--color-primary) 14%, white) 0%,
              color-mix(in oklch, var(--color-primary) 6%, #faf9f7) 40%,
              #ffffff 100%
            )
          `,
        }}
      />
      <div
        aria-hidden
        className="landing-hero-atmosphere pointer-events-none absolute inset-0 overflow-hidden opacity-60"
      >
        <span className="landing-hero-orb landing-hero-orb-a" />
        <span className="landing-hero-orb landing-hero-orb-b" />
      </div>

      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center">
        <Link
          href="/"
          className="landing-display mb-8 text-[1.35rem] text-[var(--landing-ink)] sm:mb-10"
        >
          Aide
        </Link>
        {children}
        <p className="mt-8 text-center text-[12px] text-[var(--landing-muted)]">
          <Link href="/" className="hover:text-[var(--landing-ink)]">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
