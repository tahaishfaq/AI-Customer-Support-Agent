import Link from "next/link";
import { BarChart3, BookOpen, FlaskConical } from "lucide-react";
import { AgentStatusBadge } from "@/components/agents/AgentCard";
import { cn } from "@/lib/utils";

function monogram(name) {
  if (!name) return "A";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function HomeAgentCard({ agent, conversationCount = 0, messageCount = 0 }) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]",
        "transition-colors hover:border-[var(--color-primary)]/35"
      )}
    >
      <Link href={`/agents/${agent.id}`} className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)]">
          {monogram(agent.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[var(--color-text)]">
              {agent.name}
            </h3>
            <AgentStatusBadge agent={agent} className="bg-[var(--color-bg)]" />
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {agent.description || "No description yet"}
          </p>
        </div>
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-4">
        <div>
          <p className="text-[11px] text-[var(--color-muted)]">Conversations</p>
          <p className="mt-0.5 text-lg font-semibold text-[var(--color-text)]">
            {conversationCount}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--color-muted)]">Messages</p>
          <p className="mt-0.5 text-lg font-semibold text-[var(--color-text)]">
            {messageCount}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/agents/${agent.id}/test`}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        >
          <FlaskConical className="size-3.5" />
          Test
        </Link>
        <Link
          href={`/agents/${agent.id}/knowledge`}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        >
          <BookOpen className="size-3.5" />
          Knowledge
        </Link>
        <Link
          href={`/agents/${agent.id}/analytics`}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        >
          <BarChart3 className="size-3.5" />
          Analytics
        </Link>
      </div>
    </article>
  );
}
