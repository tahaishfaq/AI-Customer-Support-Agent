"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SentimentDot } from "@/components/conversations/ConversationChips";
import { formatRelative, monogram } from "@/components/conversations/format";
import { cn } from "@/lib/utils";

const PRIORITY_BADGE = {
  URGENT: "border-red-500/45 text-red-700 dark:text-red-400",
  HIGH: "border-orange-500/40 text-orange-700 dark:text-orange-400",
  NORMAL: "",
};

export function ConversationRow({
  conversation,
  active,
  href,
  showDeskStatus = false,
}) {
  const preview = conversation.lastMessage?.content || "No messages yet";
  const when =
    conversation.lastMessage?.createdAt ||
    conversation.handoffAt ||
    conversation.startedAt;
  const title =
    showDeskStatus && conversation.waitingForHuman
      ? conversation.agent?.name || "Waiting"
      : conversation.category || conversation.agent?.name || "Conversation";
  const priority = conversation.handoffPriority || "NORMAL";

  return (
    <Link
      href={href}
      className={cn(
        "relative flex min-h-[4.5rem] gap-3 px-3.5 py-3.5 transition-colors",
        active
          ? "bg-primary/[0.07]"
          : "hover:bg-muted/45 active:bg-muted/60"
      )}
    >
      {active ? (
        <span className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-primary" />
      ) : null}
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {monogram(conversation.agent?.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {title}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelative(when)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {preview}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {showDeskStatus && conversation.waitingForHuman ? (
            <Badge
              variant="outline"
              className="rounded-full border-amber-500/40 text-amber-700"
            >
              Waiting
            </Badge>
          ) : null}
          {showDeskStatus && priority !== "NORMAL" ? (
            <Badge
              variant="outline"
              className={cn("rounded-full", PRIORITY_BADGE[priority])}
            >
              {priority === "URGENT" ? "Urgent" : "High"}
            </Badge>
          ) : null}
          {showDeskStatus && conversation.claimedByMe ? (
            <Badge variant="secondary" className="rounded-full">
              You
            </Badge>
          ) : null}
          {showDeskStatus && conversation.claimedByOther ? (
            <Badge variant="outline" className="rounded-full">
              Claimed
            </Badge>
          ) : null}
          {showDeskStatus &&
          !conversation.waitingForHuman &&
          conversation.status === "RESOLVED" ? (
            <Badge variant="secondary" className="rounded-full">
              Resolved
            </Badge>
          ) : null}
          {showDeskStatus &&
          !conversation.waitingForHuman &&
          conversation.status === "OPEN" &&
          conversation.lastHandoffEndedAt ? (
            <Badge variant="outline" className="rounded-full text-primary">
              Back to AI
            </Badge>
          ) : null}
          <SentimentDot value={conversation.sentiment} />
          <span>{conversation.category || "General"}</span>
          <span>·</span>
          <span>{conversation.messageCount || 0} msgs</span>
        </span>
      </span>
    </Link>
  );
}
