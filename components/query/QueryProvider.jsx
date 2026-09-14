"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query/client";
import { REALTIME_EVENT_TYPES } from "@/lib/realtime/constants";
import {
  REALTIME_CLIENT_EVENTS,
  REALTIME_CLIENT_STATUS,
} from "@/lib/realtime/client-events";
import { queryKeys } from "@/lib/query/keys";
import { invalidateDeskQueries } from "@/lib/query/invalidation";
import { QueryErrorBoundary } from "@/components/query/QueryErrorBoundary";

const BILLING_REFRESH_EVENT = "aide:conversation-quota-refresh";
const QUERY_RECONCILIATION_FRESH_MS = 30_000;
const DESK_REALTIME_EVENTS = new Set([
  REALTIME_EVENT_TYPES.HANDOFF_CREATED,
  REALTIME_EVENT_TYPES.MESSAGE_CREATED,
  REALTIME_EVENT_TYPES.CLAIM_UPDATED,
  REALTIME_EVENT_TYPES.STATUS_UPDATED,
  REALTIME_EVENT_TYPES.PRIORITY_UPDATED,
  REALTIME_EVENT_TYPES.CSAT_UPDATED,
  REALTIME_EVENT_TYPES.INBOX_SEEN_UPDATED,
]);

function RealtimeQuerySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = (queryKey) => {
      void queryClient.invalidateQueries({ queryKey });
    };

    const invalidateIfStale = (queryKey) => {
      const state = queryClient.getQueryState(queryKey);
      if (
        state?.dataUpdatedAt &&
        Date.now() - state.dataUpdatedAt < QUERY_RECONCILIATION_FRESH_MS
      ) {
        return;
      }
      invalidate(queryKey);
    };

    function onBillingRefresh() {
      invalidate(queryKeys.billing.status);
    }

    function onRealtimeStatus(event) {
      if (event?.detail?.status === REALTIME_CLIENT_STATUS.CONNECTED) {
        invalidateIfStale(queryKeys.billing.status);
        invalidateIfStale(queryKeys.desk.waiting);
      }
    }

    function onRealtimeEvent(event) {
      const type = event?.detail?.eventType;
      if (
        type === REALTIME_EVENT_TYPES.BILLING_SUBSCRIPTION_UPDATED ||
        type === REALTIME_EVENT_TYPES.BILLING_QUOTA_UPDATED
      ) {
        invalidate(queryKeys.billing.status);
      }
      if (DESK_REALTIME_EVENTS.has(type)) {
        void invalidateDeskQueries(queryClient, event?.detail?.conversationId);
      }
    }

    window.addEventListener(BILLING_REFRESH_EVENT, onBillingRefresh);
    window.addEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
    window.addEventListener(REALTIME_CLIENT_EVENTS.EVENT, onRealtimeEvent);
    return () => {
      window.removeEventListener(BILLING_REFRESH_EVENT, onBillingRefresh);
      window.removeEventListener(REALTIME_CLIENT_EVENTS.STATUS, onRealtimeStatus);
      window.removeEventListener(REALTIME_CLIENT_EVENTS.EVENT, onRealtimeEvent);
    };
  }, [queryClient]);

  return null;
}

export function QueryProvider({ children }) {
  const [queryClient] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeQuerySync />
      <QueryErrorBoundary>{children}</QueryErrorBoundary>
    </QueryClientProvider>
  );
}
