import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--color-primary) 32%, transparent), transparent 70%), linear-gradient(180deg, #e8f0ef 0%, #d5e8e5 45%, #eef4f3 100%)",
        }}
      />
      <div className="relative mx-auto flex min-h-[88vh] max-w-5xl flex-col justify-center px-6 py-20">
        <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-primary)] sm:text-5xl">
          Hapy
        </p>
        <h1 className="mt-6 max-w-3xl font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-5xl">
          AI customer support that turns conversations into insights
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
          Create support agents, chat with customers, and understand sentiment
          and topics — in one simple workspace.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login?mode=register"
            className={cn(buttonVariants({ size: "lg" }), "px-6")}
          >
            Get started
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-6")}
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
