"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getInboxWaitingCount } from "@/lib/api/desk";
import { DESK_NAV_BADGE_POLL_MS } from "@/lib/desk/desk-config";
import {
  REALTIME_CLIENT_EVENTS,
  REALTIME_CLIENT_STATUS,
} from "@/lib/realtime/client-events";
import { queryKeys } from "@/lib/query/keys";

export const DESK_INBOX_SEEN_EVENT = "hapy-desk-inbox-seen";

export function useDeskWaitingCount() {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const { data } = useQuery({
    queryKey: queryKeys.desk.waiting,
    queryFn: getInboxWaitingCount,
    refetchInterval: realtimeConnected ? false : DESK_NAV_BADGE_POLL_MS,
  });

  useEffect(() => {
    function onSeen(event) {
      const unread = event?.detail?.unread;
      if (typeof unread === "number") {
        queryClient.setQueryData(queryKeys.desk.waiting, (current) => ({
          ...(current || {}),
          unread,
        }));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.desk.waiting });
    }

    function onRealtimeStatus(event) {
      const connected =
        event?.detail?.status === REALTIME_CLIENT_STATUS.CONNECTED;
      setRealtimeConnected(connected);
    }

    window.addEventListener(DESK_INBOX_SEEN_EVENT, onSeen);
    window.addEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
    return () => {
      window.removeEventListener(DESK_INBOX_SEEN_EVENT, onSeen);
      window.removeEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
    };
  }, [queryClient]);

  return Number(data?.totalWaiting ?? data?.waiting ?? data?.unread) || 0;
}
