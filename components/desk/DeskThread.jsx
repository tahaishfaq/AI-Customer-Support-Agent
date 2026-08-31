"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Inbox, MessageSquareText, Send, StickyNote } from "lucide-react";
import { getConversation } from "@/lib/api/conversations";
import {
  claimConversation,
  listCannedReplies,
  resolveConversation,
  sendHumanMessage,
  sendInternalNote,
  setConversationPriority,
  signalHumanTyping,
} from "@/lib/api/desk";
import { MessageBubble } from "@/components/chat/MessageBubble";
import {
  CategoryChip,
  SentimentChip,
} from "@/components/conversations/ConversationChips";
import {
  formatDayLabel,
  formatFullDate,
  formatRelative,
  monogram,
} from "@/components/conversations/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { DESK_EMBED_POLL_MS } from "@/lib/desk/desk-config";
import { cn } from "@/lib/utils";

const POLL_MS = DESK_EMBED_POLL_MS;

const PRIORITIES = [
  { id: "NORMAL", label: "Normal" },
  { id: "HIGH", label: "High" },
  { id: "URGENT", label: "Urgent" },
];

function groupMessages(messages) {
  const groups = [];
  for (const msg of messages) {
    const day = formatDayLabel(msg.createdAt);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) {
      groups.push({ day, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  }
  return groups;
}

function applyDeskPatch(prev, patch) {
  if (!patch) return prev;
  return {
    ...prev,
    ...patch,
    agent: prev.agent,
  };
}

function DeskReplyComposer({
  disabled,
  onSend,
  onValueChange,
  cannedReplies,
  mode = "reply",
  onModeChange,
  allowReply = true,
}) {
  const [value, setValue] = useState("");
  const isNote = mode === "note";

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, mode);
    setValue("");
    onValueChange?.("");
  }

  function insertCanned(body) {
    const next = value.trim() ? `${value.trim()}\n\n${body}` : body;
    setValue(next);
    onValueChange?.(next);
  }

  return (
    <div className="shrink-0 border-t border-border/70 bg-card/95 px-3 py-3 backdrop-blur-sm sm:px-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={isNote ? "ghost" : "secondary"}
            className="h-7 rounded-full px-3 text-[11px]"
            disabled={!allowReply}
            onClick={() => onModeChange?.("reply")}
          >
            Reply
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isNote ? "secondary" : "ghost"}
            className="h-7 rounded-full px-3 text-[11px]"
            onClick={() => onModeChange?.("note")}
          >
            <StickyNote className="size-3.5" data-icon="inline-start" />
            Note
          </Button>
        </div>
        {isNote ? (
          <p className="text-[11px] text-muted-foreground">
            Team only — customer never sees this. After Return to AI, the bot
            can use note facts for better replies (without quoting them).
          </p>
        ) : null}
        {!isNote && cannedReplies?.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full text-[11px]"
                  disabled={disabled}
                />
              }
            >
              <MessageSquareText className="size-3.5" data-icon="inline-start" />
              Canned
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Insert reply</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {cannedReplies.map((reply) => (
                <DropdownMenuItem
                  key={reply.id}
                  className="cursor-pointer flex-col items-start gap-0.5"
                  onClick={() => insertCanned(reply.body)}
                >
                  <span className="font-medium">{reply.title}</span>
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">
                    {reply.body}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <InputGroup
        className={cn(
          "h-auto min-h-10 items-end rounded-xl shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
          isNote && "ring-amber-500/20"
        )}
      >
        <InputGroupTextarea
          value={value}
          disabled={disabled}
          placeholder={
            isNote ? "Add an internal note…" : "Reply as human…"
          }
          rows={1}
          className="min-h-10 max-h-28 py-2.5"
          onChange={(e) => {
            setValue(e.target.value);
            onValueChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <InputGroupAddon align="inline-end" className="pb-1.5">
          <InputGroupButton
            type="button"
            variant="default"
            size="sm"
            disabled={disabled || !value.trim()}
            onClick={submit}
            aria-label={isNote ? "Save note" : "Send reply"}
          >
            {disabled ? <Spinner /> : isNote ? <StickyNote /> : <Send />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export function DeskThread({ conversation: initial, onResolved }) {
  const [conversation, setConversation] = useState(initial);
  const [messages, setMessages] = useState(initial.messages || []);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [priorityBusy, setPriorityBusy] = useState(false);
  const [error, setError] = useState("");
  const [cannedReplies, setCannedReplies] = useState([]);
  const [composerMode, setComposerMode] = useState("reply");
  const bottomRef = useRef(null);
  const lastTypingPing = useRef(0);

  const waiting =
    conversation.waitingForHuman || conversation.status === "WAITING_HUMAN";
  const groups = groupMessages(messages);
  const priority = conversation.handoffPriority || "NORMAL";
  const claimedLabel = conversation.claimedByMe
    ? "Claimed by you"
    : conversation.claimedByOther
      ? `Claimed by ${conversation.assignedUserName || "teammate"}`
      : conversation.claimedAt
        ? "Claimed"
        : "Unclaimed";

  const refresh = useCallback(async () => {
    try {
      const data = await getConversation(conversation.id);
      setConversation(data);
      setMessages(data.messages || []);
    } catch {
      // keep last good state during poll
    }
  }, [conversation.id]);

  useEffect(() => {
    setConversation(initial);
    setMessages(initial.messages || []);
    setError("");
    setComposerMode(initial?.waitingForHuman ? "reply" : "note");
  }, [initial]);

  useEffect(() => {
    if (!waiting && composerMode === "reply") {
      setComposerMode("note");
    }
  }, [waiting, composerMode]);

  useEffect(() => {
    let cancelled = false;
    listCannedReplies()
      .then((data) => {
        if (!cancelled) setCannedReplies(data.replies || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, refresh]);

  function handleComposerChange(text) {
    if (!waiting || composerMode !== "reply" || !String(text || "").trim()) {
      return;
    }
    const now = Date.now();
    if (now - lastTypingPing.current < 1500) return;
    lastTypingPing.current = now;
    signalHumanTyping(conversation.id).catch(() => {});
  }

  async function sendComposer(text, mode = "reply") {
    if (sending) return;
    if (mode !== "note" && !waiting) return;

    const role = mode === "note" ? "INTERNAL" : "HUMAN";
    const optimisticId = `local-${mode}-${Date.now()}`;

    setSending(true);
    setError("");
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role,
        content: text,
        createdAt: new Date().toISOString(),
        local: true,
      },
    ]);

    try {
      const result =
        mode === "note"
          ? await sendInternalNote(conversation.id, text)
          : await sendHumanMessage(conversation.id, text);
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimisticId);
        return [
          ...without,
          {
            id: result.message.id,
            role: result.message.role,
            content: result.message.content,
            createdAt: result.message.createdAt,
          },
        ];
      });
      setConversation((prev) => applyDeskPatch(prev, result));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(
        err.message ||
          (mode === "note" ? "Unable to save note" : "Unable to send reply")
      );
    } finally {
      setSending(false);
    }
  }

  async function resolve(resumeAi) {
    setResolving(true);
    setError("");
    try {
      const result = await resolveConversation(conversation.id, { resumeAi });
      setConversation((prev) => applyDeskPatch(prev, result));
      onResolved?.(result);
      setResolving(false);
    } catch (err) {
      setError(err.message || "Unable to resolve");
      setResolving(false);
    }
  }

  async function toggleClaim(claim) {
    setClaiming(true);
    setError("");
    try {
      const result = await claimConversation(conversation.id, claim);
      setConversation((prev) => applyDeskPatch(prev, result));
    } catch (err) {
      setError(err.message || "Unable to update claim");
    } finally {
      setClaiming(false);
    }
  }

  async function changePriority(next) {
    if (next === priority || priorityBusy) return;
    setPriorityBusy(true);
    setError("");
    try {
      const result = await setConversationPriority(conversation.id, next);
      setConversation((prev) => applyDeskPatch(prev, result));
    } catch (err) {
      setError(err.message || "Unable to set priority");
    } finally {
      setPriorityBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-primary/[0.05] via-card to-card px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full md:hidden"
              nativeButton={false}
              render={<Link href="/inbox" />}
            >
              ← Inbox
            </Button>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary ring-1 ring-primary/15">
              {monogram(conversation.agent?.name)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {conversation.agent?.name || "Agent"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {waiting
                  ? `Waiting since ${formatRelative(conversation.handoffAt || conversation.startedAt)}`
                  : `Started ${formatFullDate(conversation.startedAt)}`}
                {waiting ? ` · ${claimedLabel}` : null}
              </p>
            </div>
          </div>
          {waiting ? (
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Priority"
              >
                {PRIORITIES.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={priority === item.id ? "secondary" : "ghost"}
                    className={cn(
                      "h-8 rounded-full px-2.5 text-[11px]",
                      priority === item.id && "ring-1 ring-border",
                      item.id === "URGENT" &&
                        priority === item.id &&
                        "bg-red-500/15 text-red-700 dark:text-red-400",
                      item.id === "HIGH" &&
                        priority === item.id &&
                        "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                    )}
                    disabled={priorityBusy || resolving}
                    onClick={() => changePriority(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              {conversation.claimedByMe ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={claiming || resolving}
                  onClick={() => toggleClaim(false)}
                >
                  {claiming ? <Spinner data-icon="inline-start" /> : null}
                  Release
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={claiming || resolving || conversation.claimedByOther}
                  onClick={() => toggleClaim(true)}
                >
                  {claiming ? <Spinner data-icon="inline-start" /> : null}
                  Claim
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={resolving}
                onClick={() => resolve(false)}
              >
                {resolving ? <Spinner data-icon="inline-start" /> : null}
                Resolve & close
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={resolving}
                onClick={() => resolve(true)}
              >
                Return to AI
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {typeof conversation.csatScore === "number" ? (
                <Badge variant="outline" className="rounded-full tabular-nums">
                  CSAT {conversation.csatScore}/5
                </Badge>
              ) : null}
              <Badge variant="secondary" className="rounded-full">
                {conversation.status === "RESOLVED" ? "Resolved" : "AI active"}
              </Badge>
            </div>
          )}
        </header>

        {waiting ? (
          <Alert className="rounded-none border-x-0 border-t-0 border-amber-500/30 bg-amber-500/10">
            <AlertDescription>
              Customer is waiting for a human reply. AI is paused for this
              thread.
              {conversation.claimedByOther
                ? ` Soft-locked — claimed by ${conversation.assignedUserName || "another teammate"}.`
                : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {conversation.handoffReason ? (
          <div className="border-b border-border bg-muted/40 px-5 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Handoff reason:</span>{" "}
            {conversation.handoffReason}
          </div>
        ) : null}

        {conversation.handoffSummary ? (
          <div className="border-b border-border bg-card px-5 py-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              Context summary
            </p>
            <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted-foreground">
              {conversation.handoffSummary}
            </pre>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
            {groups.map((group) => (
              <div key={group.day}>
                <p className="mb-3 text-center text-[11px] font-medium text-muted-foreground">
                  {group.day}
                </p>
                <div className="flex flex-col gap-3">
                  {group.messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                      responseTime={msg.responseTime}
                      createdAt={msg.createdAt}
                      showMeta
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {error ? (
          <Alert variant="destructive" className="mx-3 mb-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DeskReplyComposer
          disabled={
            sending ||
            (composerMode === "reply" && conversation.claimedByOther)
          }
          mode={composerMode}
          onModeChange={setComposerMode}
          allowReply={waiting}
          onSend={sendComposer}
          onValueChange={handleComposerChange}
          cannedReplies={cannedReplies}
        />
        {!waiting ? (
          <p className="border-t border-border px-5 py-2 text-center text-[11px] text-muted-foreground">
            Not waiting for human — you can still add internal notes.
            {conversation.agentId ? (
              <>
                {" "}
                <Link
                  href={`/agents/${conversation.agentId}/conversations/${conversation.id}`}
                  className="font-medium text-primary underline"
                >
                  Open in agent inbox
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <aside className="hidden w-[280px] shrink-0 flex-col border-l border-border bg-card xl:flex">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Desk details</h2>
        </div>
        <dl className="flex flex-col gap-4 px-4 py-4 text-sm">
          <div>
            <dt className="text-[11px] font-medium text-muted-foreground">
              Status
            </dt>
            <dd className="mt-1 font-medium text-foreground">
              {conversation.status?.replace("_", " ") || "OPEN"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-muted-foreground">
              Priority
            </dt>
            <dd className="mt-1 font-medium text-foreground">{priority}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-muted-foreground">
              Claim
            </dt>
            <dd className="mt-1 text-foreground">{claimedLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-muted-foreground">
              Topic
            </dt>
            <dd className="mt-1">
              <CategoryChip value={conversation.category} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-muted-foreground">
              Sentiment
            </dt>
            <dd className="mt-1">
              <SentimentChip value={conversation.sentiment} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-muted-foreground">
              Messages
            </dt>
            <dd className="mt-1 text-foreground">{messages.length}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export function DeskEmptyState() {
  return (
    <EmptyState
      className="h-full border-0 bg-transparent"
      icon={Inbox}
      title="Select a waiting conversation"
      description="Threads appear here when a customer requests human support from your embed widget."
    />
  );
}
