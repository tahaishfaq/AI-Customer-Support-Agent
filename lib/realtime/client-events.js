export const REALTIME_CLIENT_EVENTS = Object.freeze({
  EVENT: "aide:realtime-event",
  STATUS: "aide:realtime-status",
});

export const REALTIME_CLIENT_STATUS = Object.freeze({
  DISABLED: "disabled",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  OFFLINE: "offline",
});

export function emitRealtimeClientEvent(name, detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
