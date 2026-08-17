"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveCustomization } from "@/lib/customization/defaults";
import { playNotificationBeep } from "@/lib/customization/theme";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MessageList } from "@/components/chat/MessageList";

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

function storageKey(publicKey) {
  return `hapy:embed:${publicKey}`;
}

export function PublicWebchat({ agent, parentOrigin = "" }) {
  const customization = useMemo(() => resolveCustomization(agent), [agent]);
  const features = customization.features || {};
  const identity = customization.identity || {};
  const deploy = customization.deploy || {};
  const fullPage = deploy.chatInterface === "embedded";
  const framed = Boolean(parentOrigin);

  const [widgetOpen, setWidgetOpen] = useState(fullPage);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState(() => welcomeBubble(agent));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(agent.publicKey));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.conversationId) setConversationId(parsed.conversationId);
    } catch {
      // ignore
    }
  }, [agent.publicKey]);

  useEffect(() => {
    if (!agent.publicKey || !parentOrigin) return;
    fetch(`/api/public/agents/${agent.publicKey}/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: parentOrigin }),
    }).catch(() => {});
  }, [agent.publicKey, parentOrigin]);

  const bubbleMode = !fullPage && framed;
  const proactive =
    !widgetOpen &&
    deploy.proactiveEnabled &&
    (deploy.proactiveMessage || "Hi! Need help?");

  useEffect(() => {
    if (!bubbleMode || window.parent === window) return;
    window.parent.postMessage(
      {
        source: "hapy-widget",
        type: "frame",
        open: widgetOpen,
        proactive: Boolean(proactive),
        customLauncher: deploy.chatLauncher === "custom",
      },
      parentOrigin || "*"
    );
  }, [
    bubbleMode,
    widgetOpen,
    proactive,
    deploy.chatLauncher,
    parentOrigin,
  ]);

  const persistConversation = useCallback(
    (id) => {
      if (!id) return;
      try {
        window.localStorage.setItem(
          storageKey(agent.publicKey),
          JSON.stringify({ conversationId: id })
        );
      } catch {
        // ignore quota
      }
    },
    [agent.publicKey]
  );

  async function send(text) {
    if (sending) return;
    setSending(true);
    setError("");
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: "USER", content: text, local: true },
    ]);

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
      persistConversation(data.conversationId);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
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
      ]);
      if (features.notificationSound) playNotificationBeep();
    } catch (err) {
      setError(err.message || "Unable to send message");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  }

  const placeholder =
    identity.messagePlaceholder || "Type your message...";

  return (
    <div
      className={
        bubbleMode
          ? "flex h-full min-h-0 w-full flex-col bg-transparent"
          : "flex h-dvh min-h-0 flex-col bg-transparent"
      }
    >
      <ChatWidget
        agent={agent}
        customization={customization}
        open={fullPage ? true : widgetOpen}
        onToggle={() => setWidgetOpen((v) => !v)}
        fullPage={fullPage || !framed}
        fillHost={bubbleMode}
        align="end"
      >
        <MessageList
          messages={messages}
          loading={sending}
          compact
          themed
          showFeedback={features.messageFeedback}
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
          footer={identity.footer}
          onSend={send}
        />
      </ChatWidget>
    </div>
  );
}
