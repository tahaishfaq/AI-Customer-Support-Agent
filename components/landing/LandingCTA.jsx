import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingCTA() {
  return (
    <section className="px-6 pb-20 sm:pb-24">
      <div
        className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[1.75rem] px-8 py-12 sm:flex-row sm:items-center sm:px-12 sm:py-14"
        style={{
          background:
            "radial-gradient(ellipse 80% 120% at 0% 0%, color-mix(in srgb, white 16%, transparent), transparent 50%), linear-gradient(135deg, #0b5f58 0%, #0f766e 55%, #134e4a 100%)",
        }}
      >
        <div className="max-w-xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to build your first agent?
          </h2>
          <p className="mt-3 text-white/80">
            Create a workspace, add knowledge, and start chatting in minutes.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-w-[170px] gap-1.5 bg-white text-[var(--color-primary)] hover:bg-white/90"
            )}
          >
            Get started free
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-white/90 underline-offset-4 hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-primary)]">
            Aide
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-muted)]">
            AI Customer Support & Insights
          </p>
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <Link
            href="/login"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}
