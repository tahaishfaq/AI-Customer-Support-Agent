"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Desired sizes never depend on rendered content/iframe measurements.
// Open: 4px gutter + 380px panel ≈ 384. Closed launcher: rounded-rect + gutter.
const CLOSED_LAUNCHER_W = 80;
const CLOSED_LAUNCHER_H = 56;

export function useEmbedFrame({ enabled, open, proactive, customLauncher, position, parentOrigin, expanded = false }) {
  const sequence = useRef(0);
  const [applied, setApplied] = useState(null);
  const key = `${open}:${Boolean(proactive)}:${customLauncher}:${position}:${parentOrigin}:${expanded}`;

  useLayoutEffect(() => {
    if (!enabled || window.parent === window || !parentOrigin) return;
    // A later transition can reuse the same state key (A -> B -> A). Clear
    // readiness before the new host acknowledgement, or the panel could paint
    // inside the previous closed launcher frame for one render.
    setApplied(null);
    let origin;
    try {
      const url = new URL(parentOrigin);
      if (!['https:', 'http:'].includes(url.protocol)) return;
      origin = url.origin;
    } catch { return; }
    const generation = ++sequence.current;
    let disposed = false;
    let fallbackAllowed = false;
    let acknowledged = false;
    let tick = 0;
    const width = open
      ? expanded ? 724 : 384
      : proactive
        ? 264
        : customLauncher
          ? 148
          : CLOSED_LAUNCHER_W;
    const height = open
      ? expanded ? 880 : 592
      : proactive
        ? 184
        : customLauncher
          ? 60
          : CLOSED_LAUNCHER_H;
    function accept(anchor) {
      if (!disposed) setApplied({ key, position: anchor });
    }
    function onMessage(event) {
      const data = event.data;
      if (event.source !== window.parent || event.origin !== origin ||
          data?.source !== 'hapy-host' || data.type !== 'frame-applied' ||
          data.version !== 2 || data.generation !== generation || data.open !== open ||
          !['bottom-left', 'bottom-right'].includes(data.position) ||
          !Number.isFinite(data.width) || data.width <= 0 || data.width > 4096 ||
          !Number.isFinite(data.height) || data.height <= 0 || data.height > 4096) return;
      acknowledged = true;
      clearTimeout(timer);
      accept(data.position);
    }
    function legacyReady() {
      if (!fallbackAllowed || acknowledged || disposed) return;
      // Cached v1 hosts cannot acknowledge; reveal only after their frame grew.
      if (!open || (window.innerWidth >= 120 && window.innerHeight >= 120)) accept(position);
    }
    function onResize() {
      cancelAnimationFrame(tick);
      tick = requestAnimationFrame(legacyReady);
    }
    window.addEventListener('message', onMessage);
    window.addEventListener('resize', onResize);
    const timer = setTimeout(() => { fallbackAllowed = true; legacyReady(); }, 500);
    window.parent.postMessage({
      source: 'hapy-widget', type: 'frame', version: 2, generation,
      open, proactive: Boolean(proactive), customLauncher, position, width, height,
      ...(open && expanded ? { expanded: true } : {}),
    }, origin);
    return () => {
      disposed = true;
      clearTimeout(timer);
      cancelAnimationFrame(tick);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled, open, proactive, customLauncher, position, parentOrigin, expanded, key]);

  return {
    panelReady: !enabled || (open && applied?.key === key),
    position: applied?.position || position,
  };
}
