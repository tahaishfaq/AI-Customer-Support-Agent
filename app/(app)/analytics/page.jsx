import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AnalyticsStubPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-6 py-16">
      <div className="animate-fade-up rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-14 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <BarChart3 className="size-7" />
        </span>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          Analytics charts coming soon
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-text-secondary)]">
          Trends and topic charts will appear here later. Your KPI overview is
          already live on the dashboard.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            View Dashboard KPIs
          </Link>
          <Link
            href="/agents"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Agents
          </Link>
        </div>
      </div>
    </main>
  );
}
