import { AppHeader } from "@/components/layout/AppHeader";

export default function AppLayout({ children }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 65%), linear-gradient(180deg, #eef5f4 0%, var(--color-bg) 38%, var(--color-bg) 100%)",
        }}
      />
      <AppHeader />
      <div className="animate-page-in flex-1">{children}</div>
    </div>
  );
}
