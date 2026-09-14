"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createActivityState, normalizeActivityEvent, reduceActivityEvent } from "@/lib/chat/activity-state";

// Server turn IDs are accepted only within the locally owned request.
export function useChatActivity() {
  const current = useRef(null);
  const version = useRef(0);
  const [activeActivities, setActivities] = useState([]);
  const clearActivities = useCallback(() => {
    const previous = current.current;
    current.current = null;
    previous?.controller.abort();
    version.current++;
    setActivities([]);
  }, []);
  const beginActivity = useCallback(() => {
    current.current?.controller.abort();
    const request = { state: null, controller: new AbortController() };
    current.current = request;
    version.current++;
    setActivities([]);
    return request;
  }, []);
  const isCurrentActivity = useCallback(request => current.current === request, []);
  const activityBusy = useCallback(() => current.current !== null, []);
  const activityVersion = useCallback(() => version.current, []);
  const receiveActivity = useCallback((request, raw) => {
    if (current.current !== request) return;
    const event = normalizeActivityEvent(raw);
    if (!event) return;
    const state = request.state || createActivityState(event.turnId);
    const next = reduceActivityEvent(state, event);
    if (next === state) return;
    request.state = next;
    setActivities(next.activities);
  }, []);
  useEffect(() => () => {
    const previous = current.current;
    current.current = null;
    previous?.controller.abort();
  }, []);
  return { activeActivities, beginActivity, receiveActivity, clearActivities, isCurrentActivity, activityBusy, activityVersion };
}
