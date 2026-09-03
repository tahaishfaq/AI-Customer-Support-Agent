/** Client-only GIS readiness (no React). Used with useSyncExternalStore. */

export const GOOGLE_GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const listeners = new Set();

/** @type {"idle" | "loading" | "ready" | "error"} */
let status = "idle";

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getGoogleGisStatus() {
  return status;
}

export function subscribeGoogleGisStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function googleGisApiReady() {
  return (
    typeof window !== "undefined" && Boolean(window.google?.accounts?.id)
  );
}

export function markGoogleGisLoading() {
  if (status === "ready") return;
  status = "loading";
  emit();
}

export function markGoogleGisReady() {
  status = googleGisApiReady() ? "ready" : "error";
  emit();
}

export function markGoogleGisError() {
  status = "error";
  emit();
}

/** Retry after a failed load (script tag may already be in the document). */
export function retryGoogleGisReady({ maxFrames = 160 } = {}) {
  if (googleGisApiReady()) {
    status = "ready";
    emit();
    return;
  }

  status = "loading";
  emit();

  let frames = 0;
  function tick() {
    if (googleGisApiReady()) {
      status = "ready";
      emit();
      return;
    }
    frames += 1;
    if (frames >= maxFrames) {
      status = "error";
      emit();
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
