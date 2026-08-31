"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { welcomeBubble } from "@/lib/chat/welcome-bubble";
import {
  DESK_EMBED_POLL_MS,
  DESK_EMBED_WAIT_POLL_MS,
  DESK_WAIT_TIMEOUT_MS,
} from "@/lib/desk/desk-config";

const POLL_MS = DESK_EMBED_POLL_MS;
const WAIT_POLL_MS = DESK_EMBED_WAIT_POLL_MS;

export function messagesIncludeHumanReply(messages) {
  return (messages || []).some((m) => m.role === "HUMAN");
}

/** Desk wait state, polling, and CSAT flags for the public embed widget. */
export function useEmbedDesk({ agent, conversationId, messages, setMessages }) {
  const [waitingForHuman, setWaitingForHuman] = useState(false);
  const [handoffAt, setHandoffAt] = useState(null);
  const [humanTyping, setHumanTyping] = useState(false);
  const [deskHumanReply, setDeskHumanReply] = useState(false);
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  const [handoffEligible, setHandoffEligible] = useState(true);
  const [showHandoffCta, setShowHandoffCta] = useState(false);
  const [handoffRemaining, setHandoffRemaining] = useState(3);
  const [handoffBlockMessage, setHandoffBlockMessage] = useState("");
  const [csatPending, setCsatPending] = useState(false);
  const [csatThanks, setCsatThanks] = useState(false);

  const applyDeskState = useCallback((data) => {
    if (!data) return;
    if (typeof data.showHandoffButton === "boolean") {
      setShowHandoffCta(data.showHandoffButton);
    }
    const hasDeskFlag =
      typeof data.waitingForHuman === "boolean" || typeof data.status === "string";
    const waiting = hasDeskFlag
      ? Boolean(data.waitingForHuman || data.status === "WAITING_HUMAN")
      : null;
    if (waiting === true) {
      setWaitingForHuman(true);
      setShowHandoffCta(false);
    } else if (waiting === false) {
      setWaitingForHuman(false);
    }
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
    if (waiting === false) {
      setHumanTyping(false);
      setWaitTimedOut(false);
    }
    if (typeof data.humanTyping === "boolean" && !replied && waiting === true) {
      setHumanTyping(data.humanTyping);
    }
    if (typeof data.csatPending === "boolean") {
      setCsatPending(data.csatPending);
      if (data.csatPending) setCsatThanks(false);
    } else if (data.csatAt) {
      setCsatPending(false);
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
        const next = data.messages.length ? data.messages : welcomeBubble(agent);
        setMessages((prev) => {
          const prevLast = prev[prev.length - 1]?.id;
          const nextLast = next[next.length - 1]?.id;
          if (prev.length === next.length && prevLast && prevLast === nextLast) {
            return prev;
          }
          return next;
        });
      }
      return data;
    } catch {
      return null;
    }
  }, [agent, conversationId, applyDeskState, setMessages]);

  const resetDeskState = useCallback(() => {
    setWaitingForHuman(false);
    setHandoffAt(null);
    setHumanTyping(false);
    setDeskHumanReply(false);
    setWaitTimedOut(false);
    setHandoffEligible(true);
    setHandoffRemaining(3);
    setHandoffBlockMessage("");
    setShowHandoffCta(false);
    setCsatPending(false);
    setCsatThanks(false);
  }, []);

  const humanReplied = useMemo(
    () => deskHumanReply || messagesIncludeHumanReply(messages),
    [deskHumanReply, messages]
  );

  const showWaitingBanner = waitingForHuman && !humanReplied;

  useEffect(() => {
    if (!conversationId || !waitingForHuman) return undefined;
    const pollMs = humanReplied ? POLL_MS : WAIT_POLL_MS;
    const id = setInterval(refreshConversation, pollMs);
    return () => clearInterval(id);
  }, [conversationId, waitingForHuman, humanReplied, refreshConversation]);

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

  return {
    waitingForHuman,
    setWaitingForHuman,
    handoffAt,
    setHandoffAt,
    humanTyping,
    deskHumanReply,
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
  };
}
