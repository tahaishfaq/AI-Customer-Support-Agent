import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { AgentStatusBadge } from "@/components/agents/AgentCard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HomeAgentCard({
  agent,
  conversationCount = 0,
  messageCount = 0,
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-muted/20">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/agents/${agent.id}`}
            className="block truncate font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-foreground hover:text-primary"
          >
            {agent.name}
          </Link>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {agent.description || "No description yet"}
          </p>
        </div>
        <AgentStatusBadge agent={agent} className="shrink-0" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Conversations
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">
            {conversationCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Messages
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">
            {messageCount}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Link
          href={`/agents/${agent.id}`}
          className={cn(buttonVariants({ size: "sm" }), "gap-1")}
        >
          Open
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href={`/agents/${agent.id}/test`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
        >
          <FlaskConical className="size-3.5" />
          Test
        </Link>
      </div>
    </article>
  );
}
