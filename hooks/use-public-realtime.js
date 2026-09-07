"use client";

import { useCallback, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { REALTIME_EVENT_TYPES } from "@/lib/realtime/constants";

const PUBLIC_EVENT_TYPES = new Set([
  REALTIME_EVENT_TYPES.HANDOFF_CREATED,
  REALTIME_EVENT_TYPES.MESSAGE_CREATED,
  REALTIME_EVENT_TYPES.STATUS_UPDATED,
  REALTIME_EVENT_TYPES.CSAT_UPDATED,
]);

const PUBLIC_EPHEMERAL_EVENT_TYPES = new Set([
  REALTIME_EVENT_TYPES.TYPING_STARTED,
  REALTIME_EVENT_TYPES.TYPING_STOPPED,
]);

function socketUrl(value) {
  const url = String(value || "").trim();
  if (url.startsWith("wss://")) return `https://${url.slice(6)}`;
  if (url.startsWith("ws://")) return `http://${url.slice(5)}`;
  return url;
}

export function usePublicRealtime({
  agentPublicKey,
  conversationId,
  accessToken,
  customerSubject = null,
  onEvent,
  onStatus,
}) {
  const onEventRef = useRef(onEvent);
  const onStatusRef = useRef(onStatus);
  const socketRef = useRef(null);

  useEffect(() => {
    onEventRef.current = onEvent;
    onStatusRef.current = onStatus;
  }, [onEvent, onStatus]);

  useEffect(() => {
    if (!agentPublicKey || !conversationId || !accessToken) {
      onStatusRef.current?.("offline");
      return undefined;
    }

    let cancelled = false;
    let refreshTimer = null;
    let socket = null;
    const seenEventIds = new Set();
    const endpoint = `/api/public/agents/${agentPublicKey}/conversations/${conversationId}/realtime-token`;

    function clearRefreshTimer() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    function scheduleRefresh(expiresInSeconds) {
      clearRefreshTimer();
      refreshTimer = setTimeout(
        () => void refreshToken(),
        Math.max(15_000, Number(expiresInSeconds || 300) * 1000 - 30_000)
      );
    }

    async function refreshToken() {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-aide-conversation-access-token": accessToken,
          },
          body: JSON.stringify({ accessToken, customerSubject }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.token || !data.realtimeUrl) {
          throw new Error(data?.error?.message || "Public realtime unavailable");
        }
        if (cancelled) return;
        scheduleRefresh(data.expiresInSeconds);
        if (!socket) {
          socket = io(socketUrl(data.realtimeUrl), {
            auth: { token: data.token },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.25,
          });
          socket.on("connect", () => {
            socket.emit(
              "room:join",
              { room: `conversation:${conversationId}:public` },
              (result) => {
                if (!result?.ok) {
                  socket.disconnect();
                  onStatusRef.current?.("offline", result?.error);
                  return;
                }
                onStatusRef.current?.("connected");
              }
            );
          });
          socket.on("connect_error", (error) => {
            onStatusRef.current?.("reconnecting", error?.message);
          });
          socket.on("disconnect", (reason) => {
            if (!cancelled) onStatusRef.current?.("offline", reason);
          });
          socket.onAny((eventName, event) => {
            const ephemeral = PUBLIC_EPHEMERAL_EVENT_TYPES.has(eventName);
            if (!PUBLIC_EVENT_TYPES.has(eventName) && !ephemeral) return;
            if (!ephemeral && !event?.eventId) return;
            if (seenEventIds.has(event.eventId)) return;
            if (event?.eventId) {
              seenEventIds.add(event.eventId);
              if (seenEventIds.size > 1000) {
                const oldest = seenEventIds.values().next().value;
                if (oldest) seenEventIds.delete(oldest);
              }
            }
            if (event?.conversationId === conversationId || event?.payload?.conversationId === conversationId) {
              onEventRef.current?.({ ...event, eventName, ephemeral });
            }
          });
          socketRef.current = socket;
        } else {
          socket.auth = { token: data.token };
          if (socket.connected) {
            socket.disconnect().connect();
          }
        }
      } catch (error) {
        if (!cancelled) onStatusRef.current?.("offline", error.message);
      }
    }

    onStatusRef.current?.("connecting");
    void refreshToken();
    return () => {
      cancelled = true;
      clearRefreshTimer();
      socket?.removeAllListeners();
      socket?.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [agentPublicKey, conversationId, accessToken, customerSubject]);

  const emitEphemeral = useCallback((eventType, payload) =>
    new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        resolve({ ok: false, error: "Realtime unavailable" });
        return;
      }
      socket.emit(
        "ephemeral:event",
        {
          eventType,
          payload: {
            ...payload,
            actorType: "PUBLIC",
          },
        },
        resolve
      );
    }), []);

  return { emitEphemeral };
}
