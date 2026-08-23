"use client";

import { useEffect, useState } from "react";
import { getInboxWaitingCount } from "@/lib/api/desk";
import { DESK_NAV_BADGE_POLL_MS } from "@/lib/desk/desk-config";

const POLL_MS = DESK_NAV_BADGE_POLL_MS;

export function useDeskWaitingCount() {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getInboxWaitingCount();
        if (!cancelled) setWaiting(Number(data.waiting) || 0);
      } catch {
        if (!cancelled) setWaiting(0);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return waiting;
}
