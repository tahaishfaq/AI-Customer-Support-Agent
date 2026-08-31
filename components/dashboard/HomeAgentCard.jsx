import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, FlaskConical } from "lucide-react";
import { AgentStatusBadge } from "@/components/agents/AgentCard";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function HomeAgentCard({
  agent,
  conversationCount = 0,
  messageCount = 0,
}) {
  return (
    <Card
      size="sm"
      className="h-full transition-colors hover:bg-muted/30 hover:ring-foreground/15"
    >
      <CardHeader>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <CardTitle className="min-w-0 truncate font-heading text-base">
            <Link href={`/agents/${agent.id}`} className="hover:text-primary">
              {agent.name}
            </Link>
          </CardTitle>
          <AgentStatusBadge agent={agent} className="shrink-0" />
        </div>
        <CardDescription className="line-clamp-2 text-[13px]">
          {agent.description || "No description yet"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Conversations</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {conversationCount}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Messages</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {messageCount}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="gap-2 bg-transparent">
        <Link
          href={`/agents/${agent.id}`}
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
        >
          Open
          <ArrowRight data-icon="inline-end" />
        </Link>
        <Link
          href={`/agents/${agent.id}/test`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <FlaskConical data-icon="inline-start" />
          Test
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={`/agents/${agent.id}/knowledge`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" })
            )}
            aria-label="Knowledge"
          >
            <BookOpen />
          </Link>
          <Link
            href={`/agents/${agent.id}/analytics`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" })
            )}
            aria-label="Analytics"
          >
            <BarChart3 />
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
