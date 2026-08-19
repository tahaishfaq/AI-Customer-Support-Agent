"use client";

import { useEffect } from "react";

export function EmbedUnavailable() {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const raw = new URLSearchParams(window.location.search).get("parentOrigin");
    let parentOrigin = "";
    try {
      parentOrigin = raw ? decodeURIComponent(raw) : "";
    } catch {
      parentOrigin = raw || "";
    }
    if (!parentOrigin) return;
    try {
      window.parent.postMessage(
        { source: "hapy-widget", type: "unavailable" },
        parentOrigin
      );
    } catch {
      // Host origin mismatch — iframe stays empty and transparent.
    }
  }, []);

  return null;
}
