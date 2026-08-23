"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { resolveCustomization } from "@/lib/customization/defaults";
import {
  playNotificationBeep,
  unlockNotificationAudio,
  widgetIntro,
} from "@/lib/customization/theme";
import {
  clearActiveEmbedSession,
  saveEmbedHistory,
  upsertHistoryConversation,
} from "@/lib/embed-history";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MessageList } from "@/components/chat/MessageList";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/components/conversations/format";

import { DESK_EMBED_POLL_MS, DESK_EMBED_WAIT_POLL_MS, DESK_WAIT_TIMEOUT_MS } from "@/lib/desk/desk-config";
import { DESK_WAIT_TIMEOUT_MESSAGE } from "@/lib/desk/conversation-desk";

const POLL_MS = DESK_EMBED_POLL_MS;
const WAIT_POLL_MS = DESK_EMBED_WAIT_POLL_MS;

function welcomeBubble(agent) {
  if (!agent?.welcomeMessage) return [];
  return [
    {
      id: `welcome-${agent.publicKey}`,
      role: "ASSISTANT",
      content: agent.welcomeMessage,
      responseTime: null,
      local: true,
    },
  ];
}

function previewFromMessages(messages) {
  const last = [...(messages || [])].reverse().find((m) => m.content);
  return (last?.content || "Conversation").replace(/!\[[^\]]*\]\([^)]+\)/g, "Image").slice(0, 120);
}

function messagesIncludeHumanReply(messages) {
  return (messages || []).some((m) => m.role === "HUMAN");
}

function DeskWaitingBanner({ humanTyping, waitTimedOut }) {
  let title = "Waiting for a human reply";
  let body =
    "A team member will join this chat shortly. You can keep typing — your messages are saved.";

  if (humanTyping) {
    title = "Human agent is typing";
    body = "Someone from our team is preparing your reply…";
  } else if (waitTimedOut) {
    title = "No one available right now";
    body = DESK_WAIT_TIMEOUT_MESSAGE;
  }

  return (
    <div
      className="mx-2 mt-2 rounded-lg border border-[var(--wc-primary)]/20 bg-[var(--wc-primary)]/8 px-3 py-2.5"
      style={{ color: "var(--wc-shell-fg)" }}
    >
      <p className="text-[12px] font-medium">{title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{body}</p>
    </div>
  );
}

export function PublicWebchat({ agent, parentOrigin = "" }) {
  const customization = useMemo(() => resolveCustomization(agent), [agent]);
  const features = customization.features || {};
  const identity = customization.identity || {};
  const deploy = customization.deploy || {};
  const framed = Boolean(parentOrigin);
  const fullPage = framed
    ? false
    : deploy.chatInterface === "embedded";
  const bubbleMode = framed && !fullPage;
  const historyEnabled = features.conversationHistory !== false;
  const resetMode = features.historyReset || "never";
  const hostRef = useRef(null);

  const [widgetOpen, setWidgetOpen] = useState(fullPage);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState(() => welcomeBubble(agent));
  const [pastChats, setPastChats] = useState([]);
  const [sending, setSending] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [waitingForHuman, setWaitingForHuman] = useState(false);
  const [handoffAt, setHandoffAt] = useState(null);
  const [humanTyping, setHumanTyping] = useState(false);
  const [deskHumanReply, setDeskHumanReply] = useState(false);
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  const [handoffEligible, setHandoffEligible] = useState(true);
  const [handoffRemaining, setHandoffRemaining] = useState(3);
  const [handoffBlockMessage, setHandoffBlockMessage] = useState("");
  const [error, setError] = useState("");
  const [lastFailedText, setLastFailedText] = useState("");

  const humanReplied = useMemo(
    () => deskHumanReply || messagesIncludeHumanReply(messages),
    [deskHumanReply, messages]
  );

  const showWaitingBanner = waitingForHuman && !humanReplied;

  const applyDeskState = useCallback((data) => {
    if (!data) return;
    const waiting = Boolean(data.waitingForHuman || data.status === "WAITING_HUMAN");
    setWaitingForHuman(waiting);
    if (data.handoffAt) setHandoffAt(data.handoffAt);
    if (typeof data.handoffEligible === "boolean") {
      setHandoffEligible(data.handoffEligible);
    }
    if (typeof data.handoffRemaining === "number") {
      setHandoffRemaining(data.handoffRemaining);
    }
    if (data.handoffBlockMessage) {
      setHandoffBlockMessage(data.handoffBlockMessage);
    } else if (data.handoffEligible) {
      setHandoffBlockMessage("");
    }
    const replied =
      typeof data.hasHumanReply === "boolean"
        ? data.hasHumanReply
        : messagesIncludeHumanReply(data.messages);
    if (replied) {
      setDeskHumanReply(true);
      setHumanTyping(false);
      setWaitTimedOut(false);
    }
    if (!waiting) {
      setHumanTyping(false);
      setWaitTimedOut(false);
    }
    if (typeof data.humanTyping === "boolean" && !replied && waiting) {
      setHumanTyping(data.humanTyping);
    }
  }, []);

  const refreshConversation = useCallback(async () => {
    if (!conversationId || !agent.publicKey) return null;
    try {
      const res = await fetch(
        `/api/public/agents/${agent.publicKey}/conversations/${conversationId}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      applyDeskState(data);
      if (data.handoffAt) setHandoffAt(data.handoffAt);
      if (Array.isArray(data.messages)) {
        setMessages(data.messages.length ? data.messages : welcomeBubble(agent));
      }
      return data;
    } catch {
      return null;
    }
  }, [agent, conversationId, applyDeskState]);

  useEffect(() => {
    unlockNotificationAudio();
    if (!historyEnabled) return;
    // Fresh chat on every page load; past threads stay in history for manual reopen.
    const conversations = clearActiveEmbedSession(agent.publicKey, resetMode);
    setPastChats(conversations || []);
  }, [agent.publicKey, historyEnabled, resetMode]);

  useEffect(() => {
    // Origin lock is claimed by embed.js on the parent page (trusted Origin header).
    // Iframe pings only see the app origin and must not bind from body.parentOrigin.
    if (!agent.publicKey || !parentOrigin) return;
    let cancelled = false;
    fetch(`/api/public/agents/${agent.publicKey}/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status !== 403) return;
        try {
          window.parent.postMessage(
            { source: "hapy-widget", type: "unavailable" },
            parentOrigin
          );
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent.publicKey, parentOrigin]);

  useEffect(() => {
    if (!conversationId || !waitingForHuman) return undefined;
    const pollMs = humanReplied ? POLL_MS : WAIT_POLL_MS;
    const id = setInterval(refreshConversation, pollMs);
    return () => clearInterval(id);
  }, [conversationId, waitingForHuman, humanReplied, refreshConversation]);

  // Refresh eligibility while desk cooldown is active so the button unlocks after 30m.
  useEffect(() => {
    if (!conversationId || waitingForHuman || handoffEligible) return undefined;
    const id = setInterval(refreshConversation, 30_000);
    return () => clearInterval(id);
  }, [conversationId, waitingForHuman, handoffEligible, refreshConversation]);

  useEffect(() => {
    if (!waitingForHuman || humanReplied || !handoffAt) {
      setWaitTimedOut(false);
      return undefined;
    }

    const check = () => {
      const elapsed = Date.now() - new Date(handoffAt).getTime();
      setWaitTimedOut(elapsed >= DESK_WAIT_TIMEOUT_MS);
    };

    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [waitingForHuman, humanReplied, handoffAt]);

  const proactive =
    !widgetOpen &&
    deploy.proactiveEnabled &&
    (deploy.proactiveMessage || "Hi! Need help?");

  const postFrame = useCallback(() => {
    if (!bubbleMode || window.parent === window) return;
    const el = hostRef.current;
    const rect = el?.getBoundingClientRect();
    const width = rect ? Math.ceil(rect.width) + 8 : 72;
    const height = rect ? Math.ceil(rect.height) + 8 : 72;
    window.parent.postMessage(
      {
        source: "hapy-widget",
        type: "frame",
        open: widgetOpen,
        proactive: Boolean(proactive),
        customLauncher: deploy.chatLauncher === "custom",
        width,
        height,
      },
      parentOrigin || "*"
    );
  }, [bubbleMode, widgetOpen, proactive, deploy.chatLauncher, parentOrigin]);

  useEffect(() => {
    postFrame();
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => postFrame());
    ro.observe(el);
    return () => ro.disconnect();
  }, [postFrame]);

  const persist = useCallback(
    (nextId, nextMessages) => {
      if (!historyEnabled || !nextId) return;
      const row = {
        id: nextId,
        preview: previewFromMessages(nextMessages),
        updatedAt: new Date().toISOString(),
      };
      setPastChats((prev) => {
        const conversations = upsertHistoryConversation(prev, row);
        saveEmbedHistory(
          agent.publicKey,
          { conversations, activeId: nextId },
          resetMode
        );
        return conversations;
      });
    },
    [agent.publicKey, historyEnabled, resetMode]
  );

  async function send(text) {
    if (sending) return;
    unlockNotificationAudio();
    setSending(true);
    setError("");
    setLastFailedText("");
    setHistoryOpen(false);
    const optimisticId = `local-${Date.now()}`;
    const nextUser = [...messages, { id: optimisticId, role: "USER", content: text, local: true }];
    setMessages(nextUser);

    try {
      const res = await fetch(`/api/public/agents/${agent.publicKey}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || "Unable to send message");
      }
      setConversationId(data.conversationId);
      applyDeskState(data);
      if (data.handoffTriggered || data.waitingForHuman || data.aiPaused) {
        setWaitingForHuman(true);
        if (data.handoffAt) setHandoffAt(data.handoffAt);
      }

      if (data.aiPaused || data.waitingForHuman) {
        const full = await fetch(
          `/api/public/agents/${agent.publicKey}/conversations/${data.conversationId}`
        )
          .then((r) => r.json().catch(() => ({})))
          .catch(() => null);
        if (full?.messages?.length) {
          applyDeskState(full);
          setMessages(full.messages);
          persist(data.conversationId, full.messages);
        } else {
          const next = [
            ...nextUser.filter((m) => m.id !== optimisticId),
            {
              id: data.userMessage.id,
              role: "USER",
              content: data.userMessage.content,
            },
          ];
          if (data.message) {
            next.push({
              id: data.message.id,
              role: "ASSISTANT",
              content: data.message.content,
              responseTime: data.message.responseTime,
            });
          }
          setMessages(next);
          persist(data.conversationId, next);
        }
        setSending(false);
        return;
      }

      const next = [
        ...nextUser.filter((m) => m.id !== optimisticId),
        {
          id: data.userMessage.id,
          role: "USER",
          content: data.userMessage.content,
        },
      ];
      if (data.message) {
        next.push({
          id: data.message.id,
          role: "ASSISTANT",
          content: data.message.content,
          responseTime: data.message.responseTime,
        });
      }
      setMessages(next);
      persist(data.conversationId, next);
      if (features.notificationSound && data.message) playNotificationBeep();
      if (data.degraded) {
        setError("Generation failed — Try again");
        setLastFailedText(text);
      }
      setSending(false);
    } catch (err) {
      setError(err.message || "Unable to send message");
      setLastFailedText(text);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setSending(false);
    }
  }

  async function openPastChat(id) {
    setError("");
    try {
      const res = await fetch(
        `/api/public/agents/${agent.publicKey}/conversations/${id}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Unable to open chat");
      setConversationId(id);
      applyDeskState(data);
      if (Array.isArray(data.messages)) {
        setMessages(data.messages.length ? data.messages : welcomeBubble(agent));
      }
      setHistoryOpen(false);
      persist(id, data.messages || []);
    } catch (err) {
      setError(err.message || "Unable to open chat");
    }
  }

  async function rateMessage(messageId, rating) {
    if (!messageId || String(messageId).startsWith("welcome")) return;
    try {
      await fetch(`/api/public/agents/${agent.publicKey}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating }),
      });
    } catch {
      // keep local highlight even if network fails
    }
  }

  async function requestHandoff() {
    if (!conversationId || waitingForHuman || handoffLoading || !handoffEligible) {
      if (!handoffEligible && handoffBlockMessage) {
        setError(handoffBlockMessage);
      }
      return;
    }
    setHandoffLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/public/agents/${agent.publicKey}/conversations/${conversationId}/handoff`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Customer requested human support" }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.error?.message ||
          data?.error?.details?.message ||
          "Unable to request human support";
        applyDeskState({
          ...data?.error?.details,
          handoffEligible: false,
          handoffBlockMessage: msg,
          handoffRemaining: data?.error?.details?.handoffRemaining,
        });
        throw new Error(msg);
      }
      applyDeskState(data);
      setWaitingForHuman(true);
      setDeskHumanReply(false);
      await refreshConversation();
      setHandoffLoading(false);
    } catch (err) {
      setError(err.message || "Unable to request human support");
      setHandoffLoading(false);
    }
  }

  function resetChat() {
    setConversationId(null);
    setMessages(welcomeBubble(agent));
    setWaitingForHuman(false);
    setHandoffAt(null);
    setHumanTyping(false);
    setDeskHumanReply(false);
    setWaitTimedOut(false);
    setHandoffEligible(true);
    setHandoffRemaining(3);
    setHandoffBlockMessage("");
    setError("");
    setHistoryOpen(false);
    if (historyEnabled) {
      saveEmbedHistory(
        agent.publicKey,
        { conversations: pastChats, activeId: null },
        resetMode
      );
    }
  }

  const placeholder = identity.messagePlaceholder || "Type your message...";
  const intro = widgetIntro(agent, customization);

  const chatBody = historyOpen ? (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--wc-chat-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--wc-border)] px-3 py-2">
        <p className="text-[13px] font-semibold" style={{ color: "var(--wc-shell-fg)" }}>
          Past chats
        </p>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2" onClick={resetChat}>
          <Plus className="size-3.5" />
          New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {pastChats.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <MessageSquare className="mx-auto size-5 text-[var(--wc-muted)]" />
            <p className="mt-2 text-[12px] text-[var(--wc-muted)]">No past chats yet.</p>
          </div>
        ) : (
          <ul>
            {pastChats.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openPastChat(item.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-black/[0.03]",
                    item.id === conversationId && "bg-[var(--wc-primary)]/8"
                  )}
                >
                  <span className="truncate text-[13px]" style={{ color: "var(--wc-shell-fg)" }}>
                    {item.preview || "Conversation"}
                  </span>
                  <span className="text-[11px] text-[var(--wc-muted)]">
                    {formatRelative(item.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : (
    <>
      {showWaitingBanner ? (
        <DeskWaitingBanner
          humanTyping={humanTyping}
          waitTimedOut={waitTimedOut}
        />
      ) : null}
      <MessageList
        messages={messages}
        loading={sending}
        humanTyping={showWaitingBanner && humanTyping}
        humanTypingLabel="Human agent is typing…"
        compact
        themed
        showFeedback={features.messageFeedback && !waitingForHuman}
        intro={intro}
        onFeedback={rateMessage}
      />
      {error ? (
        <div className="mx-2 mb-1 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-2 py-1.5 text-[12px] text-[var(--color-danger)]">
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
      {!waitingForHuman && conversationId ? (
        <div className="space-y-1 px-2 pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-[12px]"
            disabled={handoffLoading || sending || !handoffEligible}
            onClick={requestHandoff}
          >
            {handoffLoading
              ? "Connecting…"
              : !handoffEligible
                ? handoffRemaining <= 0
                  ? "Human request limit reached"
                  : "Talk to a human (unavailable)"
                : "Talk to a human"}
          </Button>
          {handoffEligible ? (
            <p className="text-center text-[10px] text-[var(--wc-muted)]">
              {handoffRemaining} of 3 human requests left in this chat
            </p>
          ) : handoffBlockMessage ? (
            <p className="text-center text-[10px] leading-snug text-[var(--wc-muted)]">
              {handoffBlockMessage}
            </p>
          ) : null}
        </div>
      ) : null}
      <ChatComposer
        compact
        themed
        disabled={sending}
        placeholder={placeholder}
        allowFileUpload={features.fileUpload}
        uploadUrl={`/api/public/agents/${agent.publicKey}/files`}
        footer={identity.footer}
        onSend={send}
      />
    </>
  );

  return (
    <div
      ref={hostRef}
      className={
        bubbleMode
          ? "flex h-full min-h-0 w-full max-w-full flex-col items-end justify-end bg-transparent"
          : "flex h-dvh min-h-0 flex-col bg-transparent"
      }
    >
      <ChatWidget
        agent={agent}
        customization={customization}
        open={fullPage ? true : widgetOpen}
        onToggle={() => {
          unlockNotificationAudio();
          setWidgetOpen((v) => !v);
        }}
        fullPage={fullPage || !framed}
        fillHost={bubbleMode}
        align="end"
        historyOpen={historyOpen}
        onHistoryToggle={
          historyEnabled
            ? () => {
                unlockNotificationAudio();
                setHistoryOpen((open) => !open);
                setWidgetOpen(true);
              }
            : undefined
        }
        onReset={resetChat}
      >
        {chatBody}
      </ChatWidget>
    </div>
  );
}
