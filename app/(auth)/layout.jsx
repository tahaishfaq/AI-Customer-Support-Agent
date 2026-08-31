import Link from "next/link";
import { AuthVisualPanel } from "@/components/auth/AuthVisualPanel";

export default function AuthLayout({ children }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex min-h-0 flex-col bg-background px-4 py-6 sm:min-h-screen sm:px-6 sm:py-8 lg:px-10">
        <div className="mb-6 sm:mb-8 lg:mb-12">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-semibold text-primary"
          >
            Aide
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center pb-6 sm:pb-10">
          {/* Stable height on sm+ so login ↔ register does not jump; mobile flows naturally */}
          <div className="min-h-0 sm:min-h-[560px] lg:min-h-[620px]">{children}</div>
        </div>
      </div>
      <AuthVisualPanel />
    </div>
  );
}
