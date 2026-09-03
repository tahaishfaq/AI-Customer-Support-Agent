import Link from "next/link";
import { AideLogo } from "@/components/brand/AideLogo";
import { AuthVisualPanel } from "@/components/auth/AuthVisualPanel";

export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-dvh bg-[#F5F3F0] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <AuthVisualPanel />

      <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="mb-6 flex justify-center lg:hidden">
          <AideLogo href="/" size="lg" variant="dark" />
        </div>

        <div className="auth-sheet relative z-10 flex w-full max-w-[36rem] flex-col">
          {children}
        </div>

        <p className="mt-8 text-center text-[12px] text-[#6B665C]">
          <Link
            href="/"
            className="transition-colors hover:text-[var(--landing-ink)]"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
