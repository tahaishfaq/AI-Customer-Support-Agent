"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { HomeScreen } from "@/components/embed/messenger/HomeScreen";
import { MessagesScreen } from "@/components/embed/messenger/MessagesScreen";
import { ConversationHeader } from "@/components/embed/messenger/ConversationHeader";
import { MessengerTabBar } from "@/components/embed/messenger/MessengerParts";
import { CsatPrompt } from "@/components/chat/CsatPrompt";
import { MessageList } from "@/components/chat/MessageList";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolvePublicConfirmation } from "@/lib/api/confirmations";
import { welcomeBubble } from "@/lib/chat/welcome-bubble";
import { mergeAssistantReply } from "@/lib/chat/merge-assistant-reply";
import { resumePublicChatAfterConfirmation, sendPublicChatMessageStream } from "@/lib/api/chat";
import { useEmbedDesk } from "@/hooks/use-embed-desk";
import { usePublicRealtime } from "@/hooks/use-public-realtime";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useEmbedFrame } from "@/hooks/use-embed-frame";
import { launcherFrame } from "@/lib/customization/launcher";
import { REALTIME_EVENT_TYPES } from "@/lib/realtime/constants";

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
  const realtimeAccessTokenRef = useRef(null);

  const [widgetOpen, setWidgetOpen] = useState(fullPage);
  /** Messenger screen: "home" | "messages" | "conversation". Home is the default on open. */
  const [screen, setScreen] = useState("home");
  /** Tab the conversation's back button returns to. */
  const [returnTab, setReturnTab] = useState("home");
  const [expanded, setExpanded] = useState(false);
  const [openChatError, setOpenChatError] = useState("");
  /** True once the visitor chatted in this page session — reopening resumes the chat. */
  const engagedRef = useRef(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState(() => welcomeBubble(agent));
  const [historyScrollKey, setHistoryScrollKey] = useState(0);
  const [pastChats, setPastChats] = useState([]);
  const [sending, setSending] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [csatBusy, setCsatBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastFailedText, setLastFailedText] = useState("");
  const { activeActivities, beginActivity, clearActivities, isCurrentActivity, activityBusy, activityVersion, streamHandlers, stop } = useChatStream(setMessages);
  const setDeskMessages = useCallback((next) => {
    if (!activityBusy()) setMessages(next);
  }, [activityBusy]);
  const [publicRealtimeConnected, setPublicRealtimeConnected] = useState(false);
  const [realtimeAccessToken, setRealtimeAccessToken] = useState(null);
  /** F14-C — host setUser session (subject / accessToken / displayName). */
  const [hostUser, setHostUser] = useState(null);

  const realtimeAccessKey = (id) =>
    `aide:realtime-access:${agent.publicKey}:${id}`;

  const rememberRealtimeAccess = (id, token) => {
    if (!id || !token) return;
    realtimeAccessTokenRef.current = token;
    setRealtimeAccessToken(token);
    try {
      localStorage.setItem(realtimeAccessKey(id), token);
    } catch {
      // Browser storage may be disabled; the in-memory token remains usable.
    }
  };

  const {
    waitingForHuman,
    setWaitingForHuman,
    handoffAt,
    setHandoffAt,
    humanTyping,
    setHumanTyping,
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
  } = useEmbedDesk({
    agent,
    conversationId,
    messages,
    setMessages: setDeskMessages,
    messageBusy: activityBusy,
    messageVersion: activityVersion,
    realtimeConnected: publicRealtimeConnected,
    realtimeAccessToken,
  });
  const hostUserRef = useRef(null);

  const onPublicRealtimeEvent = useCallback(
    (event) => {
      if (event?.ephemeral) {
        if (event.eventName === REALTIME_EVENT_TYPES.TYPING_STARTED) {
          setHumanTyping(event.payload?.actorType === "OWNER");
        } else if (event.eventName === REALTIME_EVENT_TYPES.TYPING_STOPPED) {
          setHumanTyping(false);
        }
        return;
      }
      if (
        [
          "conversation.handoff.created",
          "conversation.message.created",
          "conversation.status.updated",
          "conversation.csat.updated",
        ].includes(event?.eventType)
      ) {
        if (
          event?.eventType === "conversation.message.created" &&
          event?.payload?.role === "HUMAN" &&
          !widgetOpen &&
          features.notificationSound
        ) {
          playNotificationBeep();
        }
        void refreshConversation();
      }
    },
    [features.notificationSound, refreshConversation, setHumanTyping, widgetOpen]
  );

  const onPublicRealtimeStatus = useCallback((status) => {
    setPublicRealtimeConnected(status === "connected");
    if (status !== "connected") setHumanTyping(false);
    if (status === "connected") void refreshConversation();
  }, [refreshConversation, setHumanTyping]);

  const { emitEphemeral: emitPublicEphemeral } = usePublicRealtime({
    agentPublicKey: agent.publicKey,
    conversationId,
    accessToken: realtimeAccessToken,
    customerSubject: hostUser?.subject || null,
    onEvent: onPublicRealtimeEvent,
    onStatus: onPublicRealtimeStatus,
  });

  const handlePublicComposerChange = useCallback(
    (text) => {
      if (!conversationId || !realtimeAccessToken) return;
      const eventType = String(text || "").trim()
        ? REALTIME_EVENT_TYPES.TYPING_STARTED
        : REALTIME_EVENT_TYPES.TYPING_STOPPED;
      void emitPublicEphemeral(eventType, {
        conversationId,
        expiresAt:
          eventType === REALTIME_EVENT_TYPES.TYPING_STARTED
            ? new Date(Date.now() + 5000).toISOString()
            : null,
      });
    },
    [conversationId, emitPublicEphemeral, realtimeAccessToken]
  );

  useEffect(() => {
    return () => {
      if (!conversationId || !realtimeAccessToken) return;
      void emitPublicEphemeral(REALTIME_EVENT_TYPES.TYPING_STOPPED, {
        conversationId,
        expiresAt: null,
      });
    };
  }, [conversationId, emitPublicEphemeral, realtimeAccessToken]);

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
      if (activityBusy()) return;
      const version = activityVersion();
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

      // Pre-load the last conversation for Messages; Home stays the landing screen.
      setConversationId(stored.activeId);
      try {
        let accessToken = realtimeAccessTokenRef.current;
        try {
          accessToken =
            localStorage.getItem(realtimeAccessKey(stored.activeId)) || accessToken;
          realtimeAccessTokenRef.current = accessToken;
          if (accessToken) setRealtimeAccessToken(accessToken);
        } catch {
          // Continue with the in-memory capability.
        }
        const res = await fetch(
          `/api/public/agents/${agent.publicKey}/conversations/${stored.activeId}`,
          {
            headers: {
              "x-aide-conversation-access-token": accessToken || "",
            },
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (activityBusy() || version !== activityVersion()) return;
        applyDeskState(data);
        if (data.handoffAt) setHandoffAt(data.handoffAt);
        // Waiting for (or talking to) a human: land in the conversation, not Home.
        if (data.waitingForHuman || data.aiPaused) {
          engagedRef.current = true;
          setScreen("conversation");
        }
        if (Array.isArray(data.messages) && data.messages.length) {
          setHistoryScrollKey((value) => value + 1);
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
    [agent, historyEnabled, resetMode, applyDeskState, activityBusy, activityVersion]
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
    try {
      const storedToken =
        localStorage.getItem(realtimeAccessKey(conversationId)) ||
        realtimeAccessTokenRef.current;
      realtimeAccessTokenRef.current = storedToken;
      setRealtimeAccessToken(storedToken);
    } catch {
      // Continue with the in-memory capability.
    }
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

  const frameLayout = useEmbedFrame({
    enabled: isFloatingEmbed, open: widgetOpen, proactive: Boolean(proactive),
    customLauncher: false, position: widgetPosition, parentOrigin,
    expanded: expanded && widgetOpen,
    closedSize: launcherFrame(deploy),
  });

  const postFrame = useCallback(() => {
    if (!bubbleMode || isFloatingEmbed || window.parent === window) return;
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
        customLauncher: false,
        width,
        height,
      },
      parentOrigin || "*"
    );
  }, [bubbleMode, isFloatingEmbed, widgetOpen, proactive, parentOrigin]);

  useLayoutEffect(() => {
    if (!bubbleMode || isFloatingEmbed) return undefined;
    postFrame();
    const id = requestAnimationFrame(() => postFrame());
    return () => cancelAnimationFrame(id);
  }, [bubbleMode, isFloatingEmbed, widgetOpen, screen, expanded, proactive, postFrame]);

  useEffect(() => {
    if (isFloatingEmbed) return undefined;
    postFrame();
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => postFrame());
    ro.observe(el);
    return () => ro.disconnect();
  }, [postFrame, isFloatingEmbed]);

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

  function handleStop() {
    stop();
    setSending(false);
  }

  async function send(text) {
    if (sending || activityBusy()) return;
    unlockNotificationAudio();
    setSending(true);
    engagedRef.current = true;
    setScreen("conversation");
    setError("");
    setLastFailedText("");
    const activityRequest = beginActivity();
    const optimisticId = `local-${Date.now()}`;
    const streamingId = `streaming-assistant-${Date.now()}`;
    const nextUser = [
      ...messages,
      { id: optimisticId, role: "USER", content: text, local: true },
      // Reserve assistant slot immediately so tool activity streams above a live bubble
      // (avoids empty "…" pending row while MCP/HTTP runs).
      { id: streamingId, role: "ASSISTANT", content: "", streaming: true },
    ];
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
      const data = await sendPublicChatMessageStream(agent.publicKey, {
        message: text,
        clientMessageId: optimisticId,
        conversationId: conversationId || undefined,
        userSession,
        realtimeAccessToken: realtimeAccessTokenRef.current,
        ...streamHandlers(activityRequest, streamingId, {
          onMeta: (meta) => {
            if (!meta?.conversationId) return;
            setConversationId(meta.conversationId);
            conversationIdRef.current = meta.conversationId;
            if (meta.realtimeAccessToken) {
              rememberRealtimeAccess(meta.conversationId, meta.realtimeAccessToken);
            }
          },
        }),
      });
      if (!isCurrentActivity(activityRequest)) return;
      setConversationId(data.conversationId);
      rememberRealtimeAccess(data.conversationId, data.realtimeAccessToken);
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
          `/api/public/agents/${agent.publicKey}/conversations/${data.conversationId}`,
          {
            headers: {
              "x-aide-conversation-access-token": realtimeAccessTokenRef.current || "",
            },
          }
        )
          .then((r) => r.json().catch(() => ({})))
          .catch(() => null);
        if (!isCurrentActivity(activityRequest)) return;
        if (full?.messages?.length) {
          applyDeskState(full);
          setMessages(full.messages);
          persist(data.conversationId, full.messages);
        } else {
          const next = nextUser.filter((m) => m.id !== optimisticId && m.id !== streamingId);
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
              citations: data.citations || [],
              sources: data.sources || [],
            });
          }
          setMessages(next);
          persist(data.conversationId, next);
        }
        setSending(false);
        clearActivities();
        return;
      }

      const next = nextUser.filter((m) => m.id !== optimisticId && m.id !== streamingId);
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
          citations: data.citations || [],
          sources: data.sources || [],
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
      clearActivities();
    } catch (err) {
      if (!isCurrentActivity(activityRequest)) return;
      const recoverId = conversationIdRef.current || conversationId;
      if (recoverId) {
        try {
          const snapshot = await fetch(
            `/api/public/agents/${agent.publicKey}/conversations/${recoverId}`,
            {
              headers: {
                "x-aide-conversation-access-token": realtimeAccessTokenRef.current || "",
              },
            }
          ).then((response) => (response.ok ? response.json() : null));
          if (isCurrentActivity(activityRequest) && snapshot?.messages?.length) {
            applyDeskState(snapshot);
            setMessages(snapshot.messages);
            persist(recoverId, snapshot.messages);
            setError(snapshot.activeTurn ? "Your response is still processing. Check back shortly." : "The response was recovered from the conversation.");
            setLastFailedText("");
            setSending(false);
            clearActivities();
            return;
          }
        } catch {
          // Fall through to the transport error when the snapshot is unavailable.
        }
      }
      const code = err?.details?.code;
      if (
        err?.status === 401 &&
        (code === "IDENTITY_EXPIRED" || code === "IDENTITY_INVALID" || /expired|identity/i.test(err.message || ""))
      ) {
        notifyAuthRefreshRequired(code || "IDENTITY_EXPIRED");
      }
      setError(err.message || "Unable to send message");
      setLastFailedText(text);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId && m.id !== streamingId));
      clearActivities();
      setSending(false);
    }
  }

  async function handleConfirmDecision(confirmation, decision) {
    if (activityBusy()) throw new Error("Wait for the current response to finish.");
    const cid = confirmation.conversationId || conversationId;
    if (!cid || !confirmation?.id) {
      throw new Error("Missing conversation");
    }
    const activityRequest = beginActivity();
    const streamingId = `confirmation-stream-${Date.now()}`;
    setSending(true);

    try {
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
        realtimeAccessToken: realtimeAccessTokenRef.current,
      }
    );
    if (!isCurrentActivity(activityRequest)) return;
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
          ...streamHandlers(activityRequest, streamingId),
          userSession,
          realtimeAccessToken: realtimeAccessTokenRef.current,
        });
        if (!isCurrentActivity(activityRequest)) return;
        setConversationId(data.conversationId);
        rememberRealtimeAccess(data.conversationId, data.realtimeAccessToken);
        applyDeskState(data);
        if (data.identityRefreshRequired) {
          notifyAuthRefreshRequired("IDENTITY_EXPIRED");
        }
        if (data.handoffTriggered || data.waitingForHuman || data.aiPaused) {
          setWaitingForHuman(true);
          if (data.handoffAt) setHandoffAt(data.handoffAt);
        }
        setMessages((prev) => {
          const next = mergeAssistantReply(prev.filter(message => message.id !== streamingId), data);
          persist(data.conversationId, next);
          return next;
        });
        if (features.notificationSound && data.message) playNotificationBeep();
        if (data.degraded) {
          setError("Generation failed — Try again");
        }
      } catch (err) {
        if (!isCurrentActivity(activityRequest)) return;
        setError(err.message || "Unable to continue after approval");
        throw err;
      }
    }

    } finally {
      if (isCurrentActivity(activityRequest)) {
        setMessages(previous => previous.filter(message => message.id !== streamingId));
        clearActivities();
        setSending(false);

      }
    }
  }

  async function openPastChat(id, fromTab = "messages") {
    clearActivities();
    const version = activityVersion();
    setSending(false);
    setError("");
    setOpenChatError("");
    // Each conversation has its own access capability (saved when it was created). The one in
    // memory belongs to the current chat, or is empty after "new conversation" / a reload.
    let accessToken = null;
    try {
      accessToken = localStorage.getItem(realtimeAccessKey(id));
    } catch {
      // Storage disabled: fall back to the in-memory capability.
    }
    accessToken = accessToken || (id === conversationIdRef.current ? realtimeAccessTokenRef.current : null);
    try {
      const res = await fetch(
        `/api/public/agents/${agent.publicKey}/conversations/${id}`,
        {
          headers: {
            "x-aide-conversation-access-token": accessToken || "",
          },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Unable to open chat");
      if (version !== activityVersion()) return;
      if (accessToken) rememberRealtimeAccess(id, accessToken);
      setConversationId(id);
      engagedRef.current = true;
      setReturnTab(fromTab);
      setScreen("conversation");
      applyDeskState(data);
      if (Array.isArray(data.messages)) {
        setHistoryScrollKey((value) => value + 1);
        setMessages(data.messages.length ? data.messages : welcomeBubble(agent));
      }
      persist(id, data.messages || []);
    } catch {
      if (version !== activityVersion()) return;
      // Shown on the list the visitor tapped from (Home / Messages), not a hidden chat screen.
      setOpenChatError("This conversation can't be opened on this device anymore.");
    }
  }

  async function rateMessage(messageId, rating, reason) {
    if (!messageId || String(messageId).startsWith("welcome")) return;
    try {
      await fetch(`/api/public/agents/${agent.publicKey}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aide-conversation-access-token": realtimeAccessTokenRef.current || "",
        },
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
          headers: {
            "Content-Type": "application/json",
            "x-aide-conversation-access-token": realtimeAccessTokenRef.current || "",
          },
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
          headers: {
            "Content-Type": "application/json",
            "x-aide-conversation-access-token": realtimeAccessTokenRef.current || "",
          },
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

  /** Fresh thread, straight into the conversation screen (Home / Messages / ⋯ menu). */
  function startNewConversation(fromTab = screen === "conversation" ? returnTab : screen) {
    clearActivities();
    setSending(false);
    setConversationId(null);
    engagedRef.current = true;
    setReturnTab(fromTab === "messages" ? "messages" : "home");
    setScreen("conversation");
    realtimeAccessTokenRef.current = null;
    setRealtimeAccessToken(null);
    setMessages(welcomeBubble(agent));
    resetDeskState();
    setError("");
    saveEmbedHistory(
      agent.publicKey,
      { conversations: pastChats, activeId: null },
      resetMode,
      hostUserRef.current?.subject || null
    );
  }

  const placeholder = identity.messagePlaceholder || "Type your message...";
  const intro = widgetIntro(agent, customization);
  const closeWidget = fullPage
    ? undefined
    : () => {
        unlockNotificationAudio();
        setWidgetOpen(false);
      };
  const showTabs = screen !== "conversation";
  // Home "Recent message" card: latest past chat, only when the visitor has history.
  const recentConversation = historyEnabled
    ? [...pastChats].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0] || null
    : null;

  const conversationBody = (
    <>
      <ConversationHeader
        intro={intro}
        identity={identity}
        onBack={() => setScreen(returnTab)}
        onClose={closeWidget}
        onNewConversation={() => startNewConversation(returnTab)}
        allowExpand={deploy.allowExpand !== false && !fullPage}
        expanded={expanded}
        onToggleExpand={() => setExpanded((value) => !value)}
      />
      {identity.conversationIntro ? (
        <p className="shrink-0 px-6 pt-3 text-center text-[13px]" style={{ color: "var(--wc-muted)" }}>
          {identity.conversationIntro}
        </p>
      ) : null}
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
        showKnowledgeDetails={false}
        showResponseTime={false}
        instantScrollKey={historyScrollKey}
        showFeedback={features.messageFeedback && !waitingForHuman}
        intro={intro}
        showIntro={false}
        onFeedback={rateMessage}
        onConfirmDecision={handleConfirmDecision}
        confirmBusy={sending}
        activeActivities={activeActivities}
        onSourceClarifyReply={(label) => {
          if (!label || sending) return;
          send(label);
        }}
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
        onStop={sending ? handleStop : undefined}
        placeholder={placeholder}
        allowFileUpload={features.fileUpload}
        uploadUrl={`/api/public/agents/${agent.publicKey}/files`}
        footer={
          customization.branding?.hideAideBranding && identity.footer === "by AIDE"
            ? null
            : identity.footer
        }
        onSend={send}
        onValueChange={handlePublicComposerChange}
        variant="messenger"
      />
    </>
  );

  const chatBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      {screen === "home" ? (
        <HomeScreen
          customization={customization}
          intro={intro}
          onSendMessage={() => startNewConversation("home")}
          onClose={closeWidget}
          recentConversation={recentConversation}
          onOpenConversation={(id) => {
            if (id === conversationId && engagedRef.current) {
              setReturnTab("home");
              setScreen("conversation");
              return;
            }
            openPastChat(id, "home");
          }}
          onSeeAll={() => setScreen("messages")}
        />
      ) : screen === "messages" ? (
        <MessagesScreen
          conversations={historyEnabled ? pastChats : []}
          intro={intro}
          identity={identity}
          activeId={conversationId}
          error={openChatError}
          onOpen={(id) => {
            if (id === conversationId && engagedRef.current) {
              setReturnTab("messages");
              setScreen("conversation");
              return;
            }
            openPastChat(id);
          }}
          onSendMessage={() => startNewConversation("messages")}
          onClose={closeWidget}
        />
      ) : (
        conversationBody
      )}
      {showTabs ? <MessengerTabBar active={screen} onChange={setScreen} /> : null}
    </div>
  );

  return (
    <div
      ref={hostRef}
      style={isFloatingEmbed ? { position: "fixed", inset: 0, width: "100%", maxWidth: "none", height: "100%" } : undefined}
      data-realtime-status={publicRealtimeConnected ? "connected" : "offline"}
      data-realtime-conversation={conversationId || ""}
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
          setWidgetOpen((v) => {
            // Opening lands on Home unless the visitor is mid-chat in this session.
            if (!v && !engagedRef.current) setScreen("home");
            if (v) setExpanded(false);
            return !v;
          });
        }}
        fullPage={fullPage}
        fillHost={bubbleMode}
        coordinatedFrame={isFloatingEmbed}
        panelReady={frameLayout.panelReady}
        align={positionToChatAlign(isFloatingEmbed ? frameLayout.position : widgetPosition)}
        messenger
        expanded={expanded && !fullPage}
      >
        {chatBody}
      </ChatWidget>
    </div>
  );
}
