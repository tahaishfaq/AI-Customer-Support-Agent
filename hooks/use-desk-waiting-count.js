"use client";

import { useEffect, useState } from "react";
import { getInboxWaitingCount } from "@/lib/api/desk";
import { DESK_NAV_BADGE_POLL_MS } from "@/lib/desk/desk-config";
import { REALTIME_EVENT_TYPES } from "@/lib/realtime/constants";
import {
  REALTIME_CLIENT_EVENTS,
  REALTIME_CLIENT_STATUS,
} from "@/lib/realtime/client-events";

const POLL_MS = DESK_NAV_BADGE_POLL_MS;
let lastRealtimeVersion = 0;
export const DESK_INBOX_SEEN_EVENT = "hapy-desk-inbox-seen";

export function useDeskWaitingCount() {
  const [waiting, setWaiting] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getInboxWaitingCount();
        if (!cancelled) setWaiting(Number(data.unread ?? data.waiting) || 0);
      } catch {
        if (!cancelled) setWaiting(0);
      }
    }

    load();
    const id = realtimeConnected ? null : setInterval(load, POLL_MS);
    function onSeen(event) {
      const unread = event?.detail?.unread;
      if (typeof unread === "number") {
        setWaiting(unread);
        return;
      }
      load();
    }
    window.addEventListener(DESK_INBOX_SEEN_EVENT, onSeen);
    function onRealtimeStatus(event) {
      const connected =
        event?.detail?.status === REALTIME_CLIENT_STATUS.CONNECTED;
      setRealtimeConnected(connected);
      if (connected) load();
    }
    function onRealtimeEvent(event) {
      const detail = event?.detail;
      const type = detail?.eventType;
      if (
        [
          REALTIME_EVENT_TYPES.HANDOFF_CREATED,
          REALTIME_EVENT_TYPES.STATUS_UPDATED,
          REALTIME_EVENT_TYPES.INBOX_SEEN_UPDATED,
        ].includes(type)
      ) {
        const version = Number(detail?.aggregateVersion);
        if (Number.isInteger(version) && version > 0) {
          if (version <= lastRealtimeVersion) return;
          lastRealtimeVersion = version;
        }
        load();
      }
    }
    window.addEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
    window.addEventListener(REALTIME_CLIENT_EVENTS.EVENT, onRealtimeEvent);
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
      window.removeEventListener(DESK_INBOX_SEEN_EVENT, onSeen);
      window.removeEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
      window.removeEventListener(REALTIME_CLIENT_EVENTS.EVENT, onRealtimeEvent);
    };
  }, [realtimeConnected]);

  return waiting;
}
