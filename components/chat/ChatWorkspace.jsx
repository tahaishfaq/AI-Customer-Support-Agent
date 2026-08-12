"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listAgents } from "@/lib/api/agents";
import { sendChatMessage } from "@/lib/api/chat";
import { AgentPicker } from "@/components/chat/AgentPicker";
import { MessageList } from "@/components/chat/MessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function welcomeBubble(agent) {
  if (!agent?.welcomeMessage) return [];
  return [
    {
      id: `welcome-${agent.id}`,
      role: "ASSISTANT",
      content: agent.welcomeMessage,
      responseTime: null,
      local: true,
    },
  ];
}

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const queryAgentId = searchParams.get("agentId");

  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({ category: null, sentiment: null });
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [lastFailedText, setLastFailedText] = useState("");

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === agentId) || null,
    [agents, agentId]
  );

  const resetThread = useCallback((agent) => {
    setConversationId(null);
    setMessages(welcomeBubble(agent));
    setMeta({ category: null, sentiment: null });
    setError("");
    setLastFailedText("");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingAgents(true);
      setError("");
      try {
        const list = await listAgents();
        if (cancelled) return;
        setAgents(list);
        const initial =
          (queryAgentId && list.find((a) => a.id === queryAgentId)?.id) ||
          list[0]?.id ||
          "";
        setAgentId(initial);
        const agent = list.find((a) => a.id === initial) || null;
        resetThread(agent);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load agents");
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [queryAgentId, resetThread]);

  function handleAgentChange(nextId) {
    setAgentId(nextId);
    const agent = agents.find((a) => a.id === nextId) || null;
    resetThread(agent);
  }

  async function send(text) {
    if (!agentId || sending) return;
    setSending(true);
    setError("");
    setLastFailedText("");

    const optimisticId = `local-user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: "USER", content: text, local: true },
    ]);

    try {
      const result = await sendChatMessage(agentId, {
        message: text,
        conversationId: conversationId || undefined,
      });

      setConversationId(result.conversationId);
      setMeta({
        category: result.category,
        sentiment: result.sentiment,
      });
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          {
            id: result.userMessage.id,
            role: result.userMessage.role,
            content: result.userMessage.content,
            createdAt: result.userMessage.createdAt,
          },
          {
            id: result.message.id,
            role: result.message.role,
            content: result.message.content,
            responseTime: result.message.responseTime,
            createdAt: result.message.createdAt,
          },
        ];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(err.message || "Unable to send message");
      setLastFailedText(text);
    } finally {
      setSending(false);
    }
  }

  if (loadingAgents) {
    return (
      <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <Skeleton className="h-10 w-56 bg-[var(--color-border)]" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-6">
          <Skeleton className="h-16 w-2/3 rounded-2xl bg-[var(--color-border)]" />
          <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl bg-[var(--color-border)]" />
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-14 text-center shadow-sm">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-text)]">
          Create an agent first
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[var(--color-text-secondary)]">
          Chat needs at least one agent. Add knowledge afterward for better
          answers.
        </p>
        <Link
          href="/agents/new"
          className={cn(buttonVariants({ size: "lg" }), "mt-8 inline-flex")}
        >
          New agent
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <AgentPicker
          agents={agents}
          value={agentId}
          onChange={handleAgentChange}
          disabled={sending}
        />
        <div className="flex flex-wrap items-center gap-2">
          {meta.category ? (
            <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]">
              {meta.category}
            </span>
          ) : null}
          {meta.sentiment ? (
            <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]">
              {meta.sentiment}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => resetThread(selectedAgent)}
          >
            New chat
          </Button>
        </div>
      </div>

      <MessageList messages={messages} loading={sending} />

      {error ? (
        <div className="mx-4 mb-2 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-sm text-[var(--color-danger)] sm:mx-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{error}</p>
            {lastFailedText ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sending}
                onClick={() => send(lastFailedText)}
              >
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ChatComposer disabled={sending || !agentId} onSend={send} />
    </div>
  );
}
