"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getBillingStatus } from "@/lib/api/billing";

const REFRESH_EVENT = "aide:conversation-quota-refresh";

const EMPTY = Object.freeze({
  quota: null,
  billing: null,
  loading: false,
  error: "",
});

let shared = {
  quota: null,
  billing: null,
  loading: false,
  error: "",
};
let inflight = null;
const listeners = new Set();
let subscriberCount = 0;
let focusBound = false;
let intervalId = null;

function emit() {
  shared = { ...shared };
  for (const listener of listeners) listener();
}

function getSnapshot() {
  return shared;
}

function getServerSnapshot() {
  return EMPTY;
}

async function loadShared({ force = false } = {}) {
  if (inflight) {
    if (!force) return inflight;
    try {
      await inflight;
    } catch {
      /* retry below */
    }
  }

  shared = { ...shared, loading: true, error: "" };
  emit();

  inflight = (async () => {
    try {
      const data = await getBillingStatus();
      shared = {
        quota: data.conversations,
        billing: data.billing,
        loading: false,
        error: "",
      };
      emit();
      return data;
    } catch (err) {
      shared = {
        ...shared,
        loading: false,
        error: err.message || "Unable to load usage",
      };
      emit();
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function onRefreshEvent() {
  void loadShared({ force: true });
}

function startGlobalListeners() {
  if (typeof window === "undefined" || focusBound) return;
  focusBound = true;
  window.addEventListener(REFRESH_EVENT, onRefreshEvent);
  window.addEventListener("focus", onRefreshEvent);
  intervalId = window.setInterval(onRefreshEvent, 60_000);
}

function stopGlobalListeners() {
  if (typeof window === "undefined" || !focusBound) return;
  focusBound = false;
  window.removeEventListener(REFRESH_EVENT, onRefreshEvent);
  window.removeEventListener("focus", onRefreshEvent);
  if (intervalId != null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function subscribe(onStoreChange) {
  listeners.add(onStoreChange);
  subscriberCount += 1;
  if (subscriberCount === 1) {
    if (!shared.quota && !shared.billing && !shared.error) {
      shared = { ...shared, loading: true };
    }
    startGlobalListeners();
    void loadShared();
  }
  return () => {
    listeners.delete(onStoreChange);
    subscriberCount -= 1;
    if (subscriberCount === 0) {
      stopGlobalListeners();
    }
  };
}

export function refreshConversationQuota() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  }
}

/**
 * Shared billing/quota snapshot across AppShell + dashboard mounts.
 * Multiple hooks share one in-flight GET /api/billing/status.
 */
export function useConversationQuota({ enabled = true } = {}) {
  const snapshot = useSyncExternalStore(
    enabled ? subscribe : () => () => {},
    enabled ? getSnapshot : () => EMPTY,
    getServerSnapshot
  );

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      await loadShared({ force: true });
    } catch {
      /* error stored in shared state */
    }
  }, [enabled]);

  if (!enabled) {
    return {
      quota: null,
      billing: null,
      loading: false,
      error: "",
      reload,
    };
  }

  return {
    quota: snapshot.quota,
    billing: snapshot.billing,
    loading: snapshot.loading,
    error: snapshot.error,
    reload,
  };
}
