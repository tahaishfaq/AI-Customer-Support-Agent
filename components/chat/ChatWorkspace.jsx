"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listAgents } from "@/lib/api/agents";
import { sendChatMessage, resumeChatAfterConfirmation } from "@/lib/api/chat";
import { mergeAssistantReply } from "@/lib/chat/merge-assistant-reply";
import { resolveConversationConfirmation } from "@/lib/api/confirmations";
import { getConversation } from "@/lib/api/conversations";
import { resolveCustomization } from "@/lib/customization/defaults";
import { welcomeBubble } from "@/lib/chat/welcome-bubble";
import { playNotificationBeep, widgetIntro } from "@/lib/customization/theme";
import { AgentPicker } from "@/components/chat/AgentPicker";
import { MessageList } from "@/components/chat/MessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { ChatWidget } from "@/components/chat/ChatWidget";
import {
  EMBED_PLACEMENTS,
  EmbedPreview,
  PlacementSwitcher,
} from "@/components/chat/EmbedPreview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function placementFromDeploy(deploy) {
  if (deploy?.chatInterface === "embedded") return "full-page";
  return "bottom-right";
}

function mapThreadMessages(messages) {
  return (messages || []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    responseTime: m.responseTime,
    createdAt: m.createdAt,
  }));
}

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const queryAgentId = searchParams.get("agentId");
  const queryConversationId = searchParams.get("conversationId");

  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({ category: null, sentiment: null });
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [lastFailedText, setLastFailedText] = useState("");
  const [placement, setPlacement] = useState("bottom-right");
  const [widgetOpen, setWidgetOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === agentId) || null,
    [agents, agentId]
  );

  const customization = useMemo(
    () => resolveCustomization(selectedAgent),
    [selectedAgent]
  );

  useEffect(() => {
    if (!selectedAgent) return;
    setPlacement(placementFromDeploy(customization.deploy));
  }, [selectedAgent?.id, customization.deploy.chatInterface]);

  const resetThread = useCallback((agent) => {
    setConversationId(null);
    setMessages(welcomeBubble(agent));
    setMeta({ category: null, sentiment: null });
    setError("");
    setLastFailedText("");
    setHistoryOpen(false);
  }, []);

  const resumeConversation = useCallback(async (id) => {
    if (!id) return;
    setLoadingThread(true);
    setError("");
    setLastFailedText("");
    try {
      const data = await getConversation(id);
      setConversationId(data.id);
      setAgentId(data.agentId);
      setMessages(mapThreadMessages(data.messages));
      setMeta({
        category: data.category,
        sentiment: data.sentiment,
      });
      setHistoryOpen(false);
      setWidgetOpen(true);
    } catch (err) {
      setError(err.message || "Unable to open conversation");
    } finally {
      setLoadingThread(false);
    }
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

        if (queryConversationId) {
          setMessages([]);
          await resumeConversation(queryConversationId);
        } else {
          resetThread(agent);
        }
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
  }, [queryAgentId, queryConversationId, resetThread, resumeConversation]);

  function handleAgentChange(nextId) {
    setAgentId(nextId);
    const agent = agents.find((a) => a.id === nextId) || null;
    resetThread(agent);
    setHistoryKey((k) => k + 1);
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
            toolSteps: result.toolSteps || [],
            pendingConfirmations: result.pendingConfirmations || [],
          },
        ];
      });
      setHistoryKey((k) => k + 1);
      if (customization.features.notificationSound) {
        playNotificationBeep();
      }
      if (result.degraded) {
        setError("Generation failed — Try again");
        setLastFailedText(text);
      }
      setSending(false);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(err.message || "Unable to send message");
      setLastFailedText(text);
      setSending(false);
    }
  }

  async function handleConfirmDecision(confirmation, decision) {
    const cid = confirmation.conversationId || conversationId;
    if (!cid || !confirmation?.id) {
      throw new Error("Missing conversation");
    }
    const updated = await resolveConversationConfirmation(
      cid,
      confirmation.id,
      decision
    );
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        pendingConfirmations: (m.pendingConfirmations || []).map((c) =>
          c.id === confirmation.id
            ? {
                ...c,
                status:
                  updated.status ||
                  (decision === "deny" ? "DENIED" : "APPROVED"),
              }
            : c
        ),
      }))
    );
    if (decision === "approve") {
      setSending(true);
      setError("");
      try {
        const result = await resumeChatAfterConfirmation(agentId, {
          conversationId: cid,
          confirmationId: confirmation.id,
        });
        setConversationId(result.conversationId);
        setMeta({
          category: result.category,
          sentiment: result.sentiment,
        });
        setMessages((prev) => mergeAssistantReply(prev, result));
        setHistoryKey((k) => k + 1);
        if (customization.features.notificationSound && result.message) {
          playNotificationBeep();
        }
        if (result.degraded) {
          setError("Generation failed — Try again");
        }
      } catch (err) {
        setError(err.message || "Unable to continue after approval");
        throw err;
      } finally {
        setSending(false);
      }
    }
  }

  if (loadingAgents) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <Skeleton className="h-14 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-surface)] px-6">
        <div className="max-w-md text-center">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Create an agent first
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Chat needs at least one agent. Add knowledge afterward for better
            answers.
          </p>
          <Link
            href="/agents/new"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            New agent
          </Link>
        </div>
      </div>
    );
  }

  const compact = placement !== "full-page";
  const placementMeta =
    EMBED_PLACEMENTS.find((item) => item.id === placement) || EMBED_PLACEMENTS[0];

  const chatBody = historyOpen ? (
    <ChatHistoryPanel
      agentId={agentId}
      activeId={conversationId}
      refreshKey={historyKey}
      onSelect={resumeConversation}
      onNewChat={() => resetThread(selectedAgent)}
    />
  ) : (
    <>
      {loadingThread ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[var(--wc-chat-bg,#ffffff)] px-3 py-3">
          <Skeleton className="h-14 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
        </div>
      ) : (
        <MessageList
          messages={messages}
          loading={sending}
          compact={compact}
          themed
          showFeedback={customization.features.messageFeedback}
          intro={widgetIntro(selectedAgent, customization)}
          onConfirmDecision={handleConfirmDecision}
          confirmBusy={sending}
          onFeedback={async (messageId, rating, reason) => {
            if (!messageId) return;
            await fetch(`/api/messages/${messageId}/feedback`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rating,
                ...(reason ? { reason } : {}),
              }),
            });
          }}
        />
      )}
      {error ? (
        <div className="mx-3 mb-2 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
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
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <ChatComposer
        disabled={sending || !agentId || loadingThread}
        onSend={send}
        compact={compact}
        themed
        placeholder={
          customization.identity.messagePlaceholder || "Type a message…"
        }
        footer={customization.identity.footer || undefined}
        allowFileUpload={customization.features.fileUpload}
        uploadUrl={agentId ? `/api/agents/${agentId}/files` : undefined}
      />
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <AgentPicker
            agents={agents}
            value={agentId}
            onChange={handleAgentChange}
            disabled={sending}
          />
          {meta.category ? (
            <span className="hidden rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)] sm:inline">
              {meta.category}
            </span>
          ) : null}
          {meta.sentiment ? (
            <span className="hidden rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)] sm:inline">
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
        <div className="flex flex-wrap items-center gap-2">
          <PlacementSwitcher
            value={placement}
            onChange={(next) => {
              setPlacement(next);
              setWidgetOpen(true);
            }}
          />
          <Link
            href={
              selectedAgent
                ? `/agents/${selectedAgent.id}/conversations`
                : "/agents"
            }
            className="text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Conversations
          </Link>
        </div>
      </div>

      <p className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 text-[12px] text-[var(--color-muted)]">
        Preview · {placementMeta.hint}
        {conversationId ? " · Resumed thread" : ""}
        {" · Uses Customization settings"}
      </p>

      <EmbedPreview placement={placement}>
        <ChatWidget
          agent={selectedAgent}
          customization={customization}
          open={widgetOpen}
          onToggle={() => setWidgetOpen((v) => !v)}
          align={placement === "bottom-left" ? "start" : "end"}
          fullPage={placement === "full-page"}
          historyOpen={historyOpen}
          onHistoryToggle={() => {
            setHistoryOpen((v) => !v);
            setHistoryKey((k) => k + 1);
            setWidgetOpen(true);
          }}
          onReset={() => resetThread(selectedAgent)}
        >
          {chatBody}
        </ChatWidget>
      </EmbedPreview>
    </div>
  );
}
