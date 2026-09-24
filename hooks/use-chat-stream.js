"use client";

import { useCallback, useRef } from "react";
import { useChatActivity } from "@/hooks/use-chat-activity";
import { appendStreamingDelta } from "@/lib/chat/merge-assistant-reply";

const PHASES = ["thinking", "understanding", "searching", "answering"];

/**
 * One live assistant turn over the NDJSON chat stream: pending bubble text,
 * monotonic status label, tool activity, and Stop. Stale turns are ignored.
 */
export function useChatStream(setMessages) {
  const activity = useChatActivity();
  const { isCurrentActivity, receiveActivity, clearActivities } = activity;
  const pendingRef = useRef(null);

  const streamHandlers = useCallback((request, streamingId, { onMeta } = {}) => {
    pendingRef.current = { request, streamingId };
    let phaseIndex = -1;
    const current = () => isCurrentActivity(request);
    return {
      signal: request.controller.signal,
      onMeta: meta => { if (current()) onMeta?.(meta); },
      onActivity: data => receiveActivity(request, data),
      onStatus: ({ phase, message }) => {
        const index = PHASES.indexOf(phase);
        if (!current() || index <= phaseIndex) return;
        phaseIndex = index;
        setMessages(prev => prev.map(item => item.id === streamingId ? { ...item, statusLabel: message } : item));
      },
      onText: ({ delta, replace }) => {
        if (!current()) return;
        // A cleared draft means tools run next; let the "searching" status through again.
        if (replace && !delta) phaseIndex = Math.min(phaseIndex, PHASES.indexOf("understanding"));
        setMessages(prev => appendStreamingDelta(prev, streamingId, delta, { replace }));
      },
    };
  }, [isCurrentActivity, receiveActivity, setMessages]);

  /** Abort the live turn and drop its pending bubble; the caller resets its own busy state. */
  const stop = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    clearActivities();
    if (pending) setMessages(prev => prev.filter(item => item.id !== pending.streamingId));
  }, [clearActivities, setMessages]);

  return { ...activity, streamHandlers, stop };
}
