"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { io } from "socket.io-client";
import { REALTIME_EVENT_TYPES } from "@/lib/realtime/constants";
import {
  REALTIME_CLIENT_EVENTS,
  REALTIME_CLIENT_STATUS,
  emitRealtimeClientEvent,
} from "@/lib/realtime/client-events";

const RealtimeContext = createContext({
  joinRoom: async () => ({ ok: false, error: "Realtime unavailable" }),
  leaveRoom: async () => ({ ok: false, error: "Realtime unavailable" }),
  emitEphemeral: async () => ({ ok: false, error: "Realtime unavailable" }),
});

const EPHEMERAL_EVENT_TYPES = new Set([
  REALTIME_EVENT_TYPES.TYPING_STARTED,
  REALTIME_EVENT_TYPES.TYPING_STOPPED,
  REALTIME_EVENT_TYPES.PRESENCE_UPDATED,
  REALTIME_EVENT_TYPES.VIEWING_STARTED,
  REALTIME_EVENT_TYPES.VIEWING_STOPPED,
]);

function socketUrl(value) {
  const url = String(value || "").trim();
  if (url.startsWith("wss://")) return `https://${url.slice(6)}`;
  if (url.startsWith("ws://")) return `http://${url.slice(5)}`;
  return url;
}

function isPublicOrAuthRoute(pathname) {
  return (
    !pathname ||
    pathname === "/" ||
    pathname.startsWith("/w/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email")
  );
}

async function fetchRealtimeToken(signal) {
  const response = await fetch("/api/realtime/token", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceLabel: "browser" }),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to initialize realtime");
  }
  return data;
}

export function RealtimeProvider({ children }) {
  const pathname = usePathname();
  const { status: authStatus } = useSession();
  const socketRef = useRef(null);
  const joinRoomRef = useRef(null);
  const leaveRoomRef = useRef(null);
  const emitEphemeralRef = useRef(null);
  const requestedRoomsRef = useRef(new Set());
  const seenEventIdsRef = useRef(new Set());
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const requestedRooms = requestedRoomsRef.current;
    const seenEventIds = seenEventIdsRef.current;
    const shouldConnect =
      authStatus === "authenticated" && !isPublicOrAuthRoute(pathname);
    if (!shouldConnect) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
      joinRoomRef.current = null;
      leaveRoomRef.current = null;
      emitEphemeralRef.current = null;
      requestedRooms.clear();
      seenEventIds.clear();
      emitRealtimeClientEvent(REALTIME_CLIENT_EVENTS.STATUS, {
        status: REALTIME_CLIENT_STATUS.DISABLED,
      });
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    function setStatus(status, extra = {}) {
      emitRealtimeClientEvent(REALTIME_CLIENT_EVENTS.STATUS, {
        status,
        ...extra,
      });
    }

    function clearRefreshTimer() {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    async function connectWithToken(tokenData, existingSocket = null) {
      if (cancelled || !tokenData?.enabled || !tokenData.token || !tokenData.realtimeUrl) {
        setStatus(REALTIME_CLIENT_STATUS.DISABLED);
        return;
      }

      const socket =
        existingSocket ||
        io(socketUrl(tokenData.realtimeUrl), {
          auth: { token: tokenData.token },
          transports: ["websocket", "polling"],
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10000,
          randomizationFactor: 0.25,
        });
      socketRef.current = socket;

      const joinRoom = (room) =>
        new Promise((resolve) => {
          socket.emit("room:join", { room }, (result) => resolve(result));
        });
      joinRoomRef.current = (room) => {
        requestedRooms.add(room);
        if (!socket.connected) {
          return Promise.resolve({ ok: true, queued: true, room });
        }
        return joinRoom(room);
      };
      leaveRoomRef.current = (room) => {
        requestedRooms.delete(room);
        return new Promise((resolve) => {
          if (!socket.connected) return resolve({ ok: true, room });
          socket.emit("room:leave", { room }, (result) => resolve(result));
        });
      };
      emitEphemeralRef.current = (eventType, payload) =>
        new Promise((resolve) => {
          if (!socket.connected) {
            resolve({ ok: false, error: "Realtime unavailable" });
            return;
          }
          socket.emit(
            "ephemeral:event",
            {
              eventType,
              payload: {
                ...payload,
                ...(eventType === REALTIME_EVENT_TYPES.TYPING_STARTED ||
                eventType === REALTIME_EVENT_TYPES.TYPING_STOPPED
                  ? { actorType: "OWNER", actorId: tokenData.userId }
                  : {}),
                ...(eventType === REALTIME_EVENT_TYPES.PRESENCE_UPDATED ||
                eventType === REALTIME_EVENT_TYPES.VIEWING_STARTED ||
                eventType === REALTIME_EVENT_TYPES.VIEWING_STOPPED
                  ? {
                      actorType: "OWNER",
                      userId: tokenData.userId,
                      displayName: tokenData.userName || "Team member",
                    }
                  : {}),
              },
            },
            resolve
          );
        });

      if (!existingSocket) socket.on("connect", async () => {
        const workspaceIds = Array.isArray(tokenData.workspaceIds)
          ? tokenData.workspaceIds
          : [];
        const workspaceResults = await Promise.all(
          workspaceIds.map((workspaceId) =>
            joinRoom(`workspace:${workspaceId}:desk`)
          )
        );
        const requestedResults = await Promise.all(
          [...requestedRooms].map((room) => joinRoom(room))
        );
        const failed = [...workspaceResults, ...requestedResults].find(
          (result) => !result?.ok
        );
        if (failed) {
          socket.disconnect();
          setStatus(REALTIME_CLIENT_STATUS.RECONNECTING, {
            error: failed.error || "Unable to join realtime room",
          });
          return;
        }
        setStatus(REALTIME_CLIENT_STATUS.CONNECTED, {
          workspaceIds,
          reconciled: true,
        });
      });
      if (!existingSocket) socket.on("connect_error", (error) => {
        setStatus(REALTIME_CLIENT_STATUS.RECONNECTING, {
          error: error?.message || "Realtime connection failed",
        });
      });
      if (!existingSocket) socket.on("disconnect", (reason) => {
        if (!cancelled) {
          setStatus(REALTIME_CLIENT_STATUS.OFFLINE, { reason });
        }
      });
      if (!existingSocket) socket.onAny((eventName, event) => {
        if (typeof eventName !== "string") return;
        if (EPHEMERAL_EVENT_TYPES.has(eventName)) {
          emitRealtimeClientEvent(REALTIME_CLIENT_EVENTS.EVENT, {
            ...event,
            eventName,
            ephemeral: true,
          });
          return;
        }
        if (!event?.eventId) return;
        if (seenEventIds.has(event.eventId)) return;
        seenEventIds.add(event.eventId);
        if (seenEventIds.size > 2000) {
          const oldest = seenEventIds.values().next().value;
          if (oldest) seenEventIds.delete(oldest);
        }
        emitRealtimeClientEvent(REALTIME_CLIENT_EVENTS.EVENT, {
          ...event,
          eventName,
        });
      });

      clearRefreshTimer();
      const expiresAt = new Date(tokenData.expiresAt || 0).getTime();
      const refreshIn = Math.max(15_000, expiresAt - Date.now() - 30_000);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const nextToken = await fetchRealtimeToken(controller.signal);
          if (cancelled) return;
          socket.auth = { token: nextToken.token };
          await connectWithToken(nextToken, socket);
          socket.disconnect();
          socket.connect();
        } catch (error) {
          if (!cancelled) {
            setStatus(REALTIME_CLIENT_STATUS.RECONNECTING, {
              error: error.message,
            });
          }
        }
      }, refreshIn);
    }

    async function start() {
      setStatus(REALTIME_CLIENT_STATUS.CONNECTING);
      try {
        const tokenData = await fetchRealtimeToken(controller.signal);
        if (!cancelled) await connectWithToken(tokenData);
      } catch (error) {
        if (!cancelled && error.name !== "AbortError") {
          setStatus(REALTIME_CLIENT_STATUS.OFFLINE, { error: error.message });
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      controller.abort();
      clearRefreshTimer();
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      joinRoomRef.current = null;
      leaveRoomRef.current = null;
      emitEphemeralRef.current = null;
      requestedRooms.clear();
      seenEventIds.clear();
    };
  }, [authStatus, pathname]);

  const joinRoom = useCallback(
    (room) =>
      joinRoomRef.current?.(room) ||
      Promise.resolve({ ok: false, error: "Realtime unavailable" }),
    []
  );
  const leaveRoom = useCallback(
    (room) =>
      leaveRoomRef.current?.(room) ||
      Promise.resolve({ ok: false, error: "Realtime unavailable" }),
    []
  );
  const emitEphemeral = useCallback(
    (eventType, payload) =>
      emitEphemeralRef.current?.(eventType, payload) ||
      Promise.resolve({ ok: false, error: "Realtime unavailable" }),
    []
  );
  const value = useMemo(
    () => ({ joinRoom, leaveRoom, emitEphemeral }),
    [joinRoom, leaveRoom, emitEphemeral]
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
