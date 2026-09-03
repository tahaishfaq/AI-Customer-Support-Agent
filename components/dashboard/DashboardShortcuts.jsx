import Link from "next/link";
import { ArrowUpRight, BarChart3, MessagesSquare } from "lucide-react";

const ACTIONS = [
  {
    href: "/agents",
    title: "Browse agents",
    description: "Studio, inbox, and knowledge",
    icon: MessagesSquare,
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Sentiment, topics, trends",
    icon: BarChart3,
  },
  {
    href: "/inbox",
    title: "Human desk",
    description: "Claim and reply to handoffs",
    icon: ArrowUpRight,
  },
];

export function DashboardShortcuts() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="aide-card group flex items-center gap-3 px-3.5 py-3 transition-shadow hover:shadow-md"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {action.title}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                {action.description}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
