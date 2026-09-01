"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { resolveCustomization } from "@/lib/customization/defaults";
import {
  normalizeWidgetPosition,
  positionToChatAlign,
  positionToFlexAlign,
} from "@/lib/customization/position";
import {
  playNotificationBeep,
  unlockNotificationAudio,
  widgetIntro,
} from "@/lib/customization/theme";
import {
  loadEmbedHistory,
  migrateGuestHistoryToUser,
  saveEmbedHistory,
  touchActiveConversation,
  upsertHistoryConversation,
} from "@/lib/embed-history";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CsatPrompt } from "@/components/chat/CsatPrompt";
import { MessageList } from "@/components/chat/MessageList";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/components/conversations/format";
import { resolvePublicConfirmation } from "@/lib/api/confirmations";
import { welcomeBubble } from "@/lib/chat/welcome-bubble";
import { mergeAssistantReply } from "@/lib/chat/merge-assistant-reply";
import { resumePublicChatAfterConfirmation } from "@/lib/api/chat";
import { useEmbedDesk } from "@/hooks/use-embed-desk";

import { DESK_WAIT_TIMEOUT_MESSAGE } from "@/lib/desk/conversation-desk";

function previewFromMessages(messages) {
  const last = [...(messages || [])].reverse().find((m) => m.content);
  return (last?.content || "Conversation").replace(/!\[[^\]]*\]\([^)]+\)/g, "Image").slice(0, 120);
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

export function PublicWebchat({ agent, parentOrigin = "", embedMode = "" }) {
  const customization = useMemo(() => resolveCustomization(agent), [agent]);
  const features = customization.features || {};
  const identity = customization.identity || {};
  const deploy = customization.deploy || {};
  const widgetPosition = normalizeWidgetPosition(deploy.widgetPosition);
  const framed = Boolean(parentOrigin);
  const isEmbeddedLayout = deploy.chatInterface === "embedded";
  const isContainerEmbed = embedMode === "container";
  const isFloatingEmbed = framed && !isContainerEmbed;
  const fullPage = isEmbeddedLayout && !isFloatingEmbed;
  const bubbleMode =
    isFloatingEmbed ||
    (!framed && !isEmbeddedLayout) ||
    (isContainerEmbed && !isEmbeddedLayout);
  const historyEnabled = features.conversationHistory !== false;
  const resetMode = features.historyReset || "1d";
  const hostRef = useRef(null);
  const sessionRestoredRef = useRef(false);
  const conversationIdRef = useRef(null);
  const messagesRef = useRef([]);

  const [widgetOpen, setWidgetOpen] = useState(fullPage);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState(() => welcomeBubble(agent));
  const [pastChats, setPastChats] = useState([]);
  const [sending, setSending] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [csatBusy, setCsatBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastFailedText, setLastFailedText] = useState("");
  /** F14-C — host setUser session (subject / accessToken / displayName). */
  const [hostUser, setHostUser] = useState(null);

  const {
    waitingForHuman,
    setWaitingForHuman,
    handoffAt,
    setHandoffAt,
    humanTyping,
    setDeskHumanReply,
    waitTimedOut,
    handoffEligible,
    showHandoffCta,
    setShowHandoffCta,
    handoffRemaining,
    handoffBlockMessage,
    csatPending,
    setCsatPending,
    csatThanks,
    setCsatThanks,
    applyDeskState,
    refreshConversation,
    resetDeskState,
    humanReplied,
    showWaitingBanner,
  } = useEmbedDesk({ agent, conversationId, messages, setMessages });
  const hostUserRef = useRef(null);

  useLayoutEffect(() => {
    hostUserRef.current = hostUser;
    conversationIdRef.current = conversationId;
    messagesRef.current = messages;
  }, [hostUser, conversationId, messages]);

  useEffect(() => {
    if (!bubbleMode) return;
    const flex = positionToFlexAlign(widgetPosition);
    const html = document.documentElement;
    const body = document.body;
    body.style.alignItems = flex.alignItems;
    body.style.justifyContent = flex.justifyContent;
    // Size to content so iframe measurements stay accurate (avoids h-full stretch bugs).
    html.style.height = "auto";
    html.style.minHeight = "0";
    html.style.width = "auto";
    body.style.height = "auto";
    body.style.minHeight = "0";
    body.style.width = "auto";
    return () => {
      html.style.height = "";
      html.style.minHeight = "";
      html.style.width = "";
      body.style.height = "";
      body.style.minHeight = "";
      body.style.width = "";
    };
  }, [bubbleMode, widgetPosition]);

  function notifyAuthRefreshRequired(code = "IDENTITY_EXPIRED") {
    if (!parentOrigin) return;
    try {
      window.parent.postMessage(
        {
          source: "hapy-widget",
          type: "authRefreshRequired",
          code,
        },
        parentOrigin
      );
    } catch {
      // ignore
    }
  }

  const restoreActiveSession = useCallback(
    async (userSubject = null, { preserveInMemory = false } = {}) => {
      const subject =
        typeof userSubject === "string" && userSubject.trim()
          ? userSubject.trim()
          : null;
      const stored = loadEmbedHistory(agent.publicKey, resetMode, subject);
      if (historyEnabled) setPastChats(stored.conversations || []);

      if (!stored.activeId) {
        if (preserveInMemory && conversationIdRef.current) return;
        setConversationId(null);
        setMessages(welcomeBubble(agent));
        return;
      }

      setConversationId(stored.activeId);
      try {
        const res = await fetch(
          `/api/public/agents/${agent.publicKey}/conversations/${stored.activeId}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        applyDeskState(data);
        if (data.handoffAt) setHandoffAt(data.handoffAt);
        if (Array.isArray(data.messages) && data.messages.length) {
          setMessages(data.messages);
        }
        const touched = touchActiveConversation(
          agent.publicKey,
          resetMode,
          subject,
          stored.activeId,
          data.messages
        );
        if (historyEnabled) setPastChats(touched.conversations);
      } catch {
        // keep welcome until next send
      }
    },
    [agent, historyEnabled, resetMode, applyDeskState]
  );

  const bindOrRestoreUserSession = useCallback(
    async (userSubject) => {
      const subject =
        typeof userSubject === "string" && userSubject.trim()
          ? userSubject.trim()
          : null;
      if (!subject) {
        await restoreActiveSession(null);
        return;
      }

      migrateGuestHistoryToUser(agent.publicKey, resetMode, subject);
      const stored = loadEmbedHistory(agent.publicKey, resetMode, subject);
      const activeConversationId = conversationIdRef.current;

      if (!stored.activeId && activeConversationId) {
        const touched = touchActiveConversation(
          agent.publicKey,
          resetMode,
          subject,
          activeConversationId,
          messagesRef.current
        );
        if (historyEnabled) setPastChats(touched.conversations);
        return;
      }

      await restoreActiveSession(subject, {
        preserveInMemory: Boolean(activeConversationId && !stored.activeId),
      });
    },
    [agent.publicKey, resetMode, historyEnabled, restoreActiveSession]
  );

  useEffect(() => {
    unlockNotificationAudio();
    const timer = window.setTimeout(() => {
      if (sessionRestoredRef.current) return;
      if (hostUserRef.current?.subject) return;
      sessionRestoredRef.current = true;
      restoreActiveSession(null);
    }, parentOrigin ? 600 : 300);
    return () => window.clearTimeout(timer);
  }, [agent.publicKey, parentOrigin, restoreActiveSession]);

  useEffect(() => {
    if (!conversationId) return;
    const subject = hostUserRef.current?.subject || null;
    const { conversations } = touchActiveConversation(
      agent.publicKey,
      resetMode,
      subject,
      conversationId,
      messages
    );
    if (historyEnabled) setPastChats(conversations);
    // Save activeId as soon as we have one; preview text is refreshed on send/restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages read once per id change
  }, [conversationId, hostUser?.subject, agent.publicKey, resetMode, historyEnabled]);

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

  // F14-C — receive host setUser / announce ready for handshake
  useEffect(() => {
    function onHostMessage(event) {
      if (parentOrigin && event.origin !== parentOrigin) return;
      if (!event.data || event.data.source !== "hapy-host") return;
      if (event.data.type === "setUser") {
        const raw = event.data.user;
        const handshake = Boolean(event.data.handshake);

        if (!raw) {
          setHostUser(null);
          // Initial ready handshake may send null before the host hydrates auth — do not wipe chat.
          if (!handshake) {
            sessionRestoredRef.current = true;
            restoreActiveSession(null);
          }
          return;
        }

        sessionRestoredRef.current = true;
        const subject = raw.subject || raw.sub || null;
        setHostUser({
          subject,
          accessToken: raw.accessToken || raw.token || null,
          displayName: raw.displayName || raw.name || null,
        });
        bindOrRestoreUserSession(subject);
      }
    }
    window.addEventListener("message", onHostMessage);
    if (parentOrigin) {
      try {
        window.parent.postMessage(
          { source: "hapy-widget", type: "ready" },
          parentOrigin
        );
      } catch {
        // ignore
      }
    }
    return () => window.removeEventListener("message", onHostMessage);
  }, [parentOrigin, bindOrRestoreUserSession]);

  const proactive =
    !widgetOpen &&
    deploy.proactiveEnabled &&
    (deploy.proactiveMessage || "Hi! Need help?");

  const postFrame = useCallback(() => {
    if (!bubbleMode || window.parent === window) return;
    const host = hostRef.current;
    const el = host?.firstElementChild ?? host;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let width = Math.max(Math.ceil(rect.width) + 4, 56);
    let height = Math.max(Math.ceil(rect.height) + 4, 56);
    if (proactive && !widgetOpen) {
      width = Math.max(width, 220);
      height = Math.max(height, 120);
    }
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

  useLayoutEffect(() => {
    if (!bubbleMode) return undefined;
    postFrame();
    const id = requestAnimationFrame(() => postFrame());
    return () => cancelAnimationFrame(id);
  }, [bubbleMode, widgetOpen, historyOpen, proactive, postFrame]);

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
      if (!nextId) return;
      const subject = hostUserRef.current?.subject || null;
      const row = {
        id: nextId,
        preview: previewFromMessages(nextMessages),
        updatedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      };
      setPastChats((prev) => {
        const conversations = upsertHistoryConversation(prev, row);
        saveEmbedHistory(
          agent.publicKey,
          { conversations, activeId: nextId },
          resetMode,
          subject
        );
        return conversations;
      });
    },
    [agent.publicKey, resetMode]
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
      const user = hostUserRef.current;
      const userSession =
        user && (user.subject || user.accessToken)
          ? {
              ...(user.subject ? { subject: user.subject } : {}),
              ...(user.accessToken ? { accessToken: user.accessToken } : {}),
              ...(user.displayName ? { displayName: user.displayName } : {}),
            }
          : undefined;
      const res = await fetch(`/api/public/agents/${agent.publicKey}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId || undefined,
          ...(userSession ? { userSession } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data?.error?.details?.code || data?.error?.code;
        if (
          res.status === 401 &&
          (code === "IDENTITY_EXPIRED" ||
            code === "IDENTITY_INVALID" ||
            /expired|identity/i.test(data?.error?.message || ""))
        ) {
          notifyAuthRefreshRequired(code || "IDENTITY_EXPIRED");
        }
        throw new Error(data?.error?.message || "Unable to send message");
      }
      setConversationId(data.conversationId);
      applyDeskState(data);
      if (data.identityRefreshRequired) {
        notifyAuthRefreshRequired("IDENTITY_EXPIRED");
      }
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
          const next = nextUser.filter((m) => m.id !== optimisticId);
          if (data.userMessage) {
            next.push({
              id: data.userMessage.id,
              role: "USER",
              content: data.userMessage.content,
            });
          }
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

      const next = nextUser.filter((m) => m.id !== optimisticId);
      if (data.userMessage) {
        next.push({
          id: data.userMessage.id,
          role: "USER",
          content: data.userMessage.content,
        });
      }
      if (data.message) {
        next.push({
          id: data.message.id,
          role: "ASSISTANT",
          content: data.message.content,
          responseTime: data.message.responseTime,
          toolSteps: data.toolSteps || [],
          pendingConfirmations: data.pendingConfirmations || [],
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

  async function handleConfirmDecision(confirmation, decision) {
    const cid = confirmation.conversationId || conversationId;
    if (!cid || !confirmation?.id) {
      throw new Error("Missing conversation");
    }
    const updated = await resolvePublicConfirmation(
      agent.publicKey,
      confirmation.id,
      {
        conversationId: cid,
        decision,
        ...(hostUserRef.current?.subject
          ? { userSubject: hostUserRef.current.subject }
          : {}),
        ...(hostUserRef.current?.displayName
          ? { userDisplay: hostUserRef.current.displayName }
          : {}),
      }
    );
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        pendingConfirmations: (m.pendingConfirmations || []).map((c) =>
          c.id === confirmation.id
            ? { ...c, status: updated.status || (decision === "deny" ? "DENIED" : "APPROVED") }
            : c
        ),
      }))
    );
    if (decision === "approve") {
      setSending(true);
      setError("");
      try {
        const user = hostUserRef.current;
        const userSession =
          user && (user.subject || user.accessToken)
            ? {
                ...(user.subject ? { subject: user.subject } : {}),
                ...(user.accessToken ? { accessToken: user.accessToken } : {}),
                ...(user.displayName ? { displayName: user.displayName } : {}),
              }
            : undefined;
        const data = await resumePublicChatAfterConfirmation(agent.publicKey, {
          conversationId: cid,
          confirmationId: confirmation.id,
          userSession,
        });
        setConversationId(data.conversationId);
        applyDeskState(data);
        if (data.identityRefreshRequired) {
          notifyAuthRefreshRequired("IDENTITY_EXPIRED");
        }
        if (data.handoffTriggered || data.waitingForHuman || data.aiPaused) {
          setWaitingForHuman(true);
          if (data.handoffAt) setHandoffAt(data.handoffAt);
        }
        setMessages((prev) => {
          const next = mergeAssistantReply(prev, data);
          persist(data.conversationId, next);
          return next;
        });
        if (features.notificationSound && data.message) playNotificationBeep();
        if (data.degraded) {
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

  async function rateMessage(messageId, rating, reason) {
    if (!messageId || String(messageId).startsWith("welcome")) return;
    try {
      await fetch(`/api/public/agents/${agent.publicKey}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          rating,
          ...(reason ? { reason } : {}),
        }),
      });
    } catch {
      // keep local highlight even if network fails
    }
  }

  async function submitCsat({ score, skip = false } = {}) {
    if (!conversationId || csatBusy) return;
    setCsatBusy(true);
    try {
      const res = await fetch(
        `/api/public/agents/${agent.publicKey}/conversations/${conversationId}/csat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(skip ? { skip: true } : { score }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || "Unable to save rating");
      }
      setCsatPending(false);
      if (!skip && score) setCsatThanks(true);
      applyDeskState(data);
    } catch (err) {
      setError(err.message || "Unable to save rating");
    } finally {
      setCsatBusy(false);
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
    setShowHandoffCta(false);
    setWaitingForHuman(true);
    setCsatPending(false);
    setCsatThanks(false);
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
        const details = data?.error?.details || {};
        const msg =
          data?.error?.message ||
          details.message ||
          "Unable to request human support";
        if (res.status === 409 && details.code === "already_waiting") {
          applyDeskState({
            waitingForHuman: true,
            status: "WAITING_HUMAN",
            ...details,
          });
          await refreshConversation();
          setHandoffLoading(false);
          return;
        }
        applyDeskState({
          ...details,
          handoffEligible: false,
          handoffBlockMessage: msg,
          handoffRemaining: details.handoffRemaining,
        });
        throw new Error(msg);
      }
      applyDeskState(data);
      setWaitingForHuman(true);
      setShowHandoffCta(false);
      setDeskHumanReply(false);
      await refreshConversation();
      setHandoffLoading(false);
    } catch (err) {
      setWaitingForHuman(false);
      setShowHandoffCta(true);
      setError(err.message || "Unable to request human support");
      setHandoffLoading(false);
    }
  }

  function resetChat() {
    setConversationId(null);
    setMessages(welcomeBubble(agent));
    resetDeskState();
    setError("");
    setHistoryOpen(false);
    saveEmbedHistory(
      agent.publicKey,
      { conversations: pastChats, activeId: null },
      resetMode,
      hostUserRef.current?.subject || null
    );
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
      {csatPending && !waitingForHuman ? (
        <CsatPrompt
          busy={csatBusy}
          onRate={(score) => submitCsat({ score })}
          onSkip={() => submitCsat({ skip: true })}
        />
      ) : null}
      {csatThanks && !csatPending ? (
        <div
          className="mx-2 mt-2 rounded-lg border border-[var(--wc-primary)]/15 bg-[var(--wc-primary)]/6 px-3 py-2 text-[12px]"
          style={{ color: "var(--wc-shell-fg)" }}
        >
          Thanks for your feedback.
        </div>
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
        onConfirmDecision={handleConfirmDecision}
        confirmBusy={sending}
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
      {!waitingForHuman && conversationId && showHandoffCta ? (
        <div className="space-y-1 px-2 pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-[12px] transition-none"
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
          ? cn(
              "flex h-auto w-fit max-w-[calc(100vw-1rem)] shrink-0 flex-col bg-transparent",
              positionToChatAlign(widgetPosition) === "start"
                ? "items-start self-start"
                : "items-end self-end"
            )
          : fullPage
            ? "flex h-full min-h-0 flex-col bg-transparent"
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
        fullPage={fullPage}
        fillHost={bubbleMode}
        align={positionToChatAlign(widgetPosition)}
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
