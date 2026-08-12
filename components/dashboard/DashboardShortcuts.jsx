import Link from "next/link";
import { Bot, MessageSquare, BarChart3, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  {
    href: "/agents/new",
    title: "Create Agent",
    description: "Set up a new AI support assistant",
    icon: Bot,
    primary: true,
  },
  {
    href: "/chat",
    title: "Open Chat",
    description: "Talk to your AI support agents",
    icon: MessageSquare,
  },
  {
    href: "/analytics",
    title: "View Analytics",
    description: "Charts coming soon — KPIs below",
    icon: BarChart3,
  },
];

export function DashboardShortcuts() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
              action.primary
                ? "border-[var(--color-primary)]/20 bg-[var(--color-primary)] text-white shadow-sm shadow-[var(--color-primary)]/20"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  action.primary
                    ? "bg-white/15"
                    : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                )}
              >
                <Icon className="size-5" />
              </span>
              <ArrowUpRight
                className={cn(
                  "size-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
                  action.primary ? "text-white/70" : "text-[var(--color-muted)]"
                )}
              />
            </div>
            <p className="mt-4 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight">
              {action.title}
            </p>
            <p
              className={cn(
                "mt-1 text-sm leading-relaxed",
                action.primary ? "text-white/80" : "text-[var(--color-text-secondary)]"
              )}
            >
              {action.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
