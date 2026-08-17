import Link from "next/link";
import { BarChart3, Bot, MessagesSquare } from "lucide-react";

const ACTIONS = [
  {
    href: "/agents/new",
    title: "Create Agent",
    description: "Set up a new support assistant",
    icon: Bot,
  },
  {
    href: "/conversations",
    title: "Conversations",
    description: "Read and reply in the inbox",
    icon: MessagesSquare,
  },
  {
    href: "/analytics",
    title: "View Analytics",
    description: "Sentiment, topics, and trends",
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
            className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-primary)]/30"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--color-text)]">
                {action.title}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-[var(--color-muted)]">
                {action.description}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
