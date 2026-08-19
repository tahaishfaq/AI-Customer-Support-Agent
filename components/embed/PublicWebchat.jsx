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
  loadEmbedHistory,
  saveEmbedHistory,
  upsertHistoryConversation,
} from "@/lib/embed-history";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MessageList } from "@/components/chat/MessageList";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/components/conversations/format";

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
  const [error, setError] = useState("");

  useEffect(() => {
    unlockNotificationAudio();
    if (!historyEnabled) return;
    const stored = loadEmbedHistory(agent.publicKey, resetMode);
    setPastChats(stored.conversations || []);
    if (stored.activeId) setConversationId(stored.activeId);
  }, [agent.publicKey, historyEnabled, resetMode]);

  useEffect(() => {
    if (!agent.publicKey || !parentOrigin) return;
    let cancelled = false;
    fetch(`/api/public/agents/${agent.publicKey}/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: parentOrigin }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) return;
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

  const proactive =
    !widgetOpen &&
    deploy.proactiveEnabled &&
    (deploy.proactiveMessage || "Hi! Need help?");

  const postFrame = useCallback(() => {
    if (!bubbleMode || window.parent === window) return;
    const el = hostRef.current;
    const width = el ? Math.ceil(el.getBoundingClientRect().width) : 72;
    const height = el ? Math.ceil(el.getBoundingClientRect().height) : 72;
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
      const next = [
        ...nextUser.filter((m) => m.id !== optimisticId),
        {
          id: data.userMessage.id,
          role: "USER",
          content: data.userMessage.content,
        },
        {
          id: data.message.id,
          role: "ASSISTANT",
          content: data.message.content,
          responseTime: data.message.responseTime,
        },
      ];
      setMessages(next);
      persist(data.conversationId, next);
      if (features.notificationSound) playNotificationBeep();
    } catch (err) {
      setError(err.message || "Unable to send message");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
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
      setMessages(data.messages || welcomeBubble(agent));
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

  function resetChat() {
    setConversationId(null);
    setMessages(welcomeBubble(agent));
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
      <MessageList
        messages={messages}
        loading={sending}
        compact
        themed
        showFeedback={features.messageFeedback}
        intro={intro}
        onFeedback={rateMessage}
      />
      {error ? (
        <p className="px-3 pb-1 text-[12px] text-red-500">{error}</p>
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
          ? "inline-flex w-fit max-w-full flex-col bg-transparent"
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
