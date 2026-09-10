"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBillingStatus } from "@/lib/api/billing";
import {
  REALTIME_CLIENT_EVENTS,
  REALTIME_CLIENT_STATUS,
} from "@/lib/realtime/client-events";
import { queryKeys } from "@/lib/query/keys";

const REFRESH_EVENT = "aide:conversation-quota-refresh";
const BILLING_FALLBACK_POLL_MS = 60_000;

export function refreshConversationQuota() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  }
}

export function useConversationQuota({ enabled = true } = {}) {
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.billing.status,
    queryFn: getBillingStatus,
    enabled,
    refetchInterval: realtimeConnected ? false : BILLING_FALLBACK_POLL_MS,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    function onRealtimeStatus(event) {
      const connected =
        event?.detail?.status === REALTIME_CLIENT_STATUS.CONNECTED;
      setRealtimeConnected(connected);
    }

    window.addEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
    return () => {
      window.removeEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
    };
  }, [enabled]);

  return {
    quota: query.data?.conversations || null,
    billing: query.data?.billing || null,
    loading: query.isPending,
    error: query.error?.message || "",
    reload: query.refetch,
  };
}
