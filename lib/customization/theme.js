/** Derive CSS variables + class tokens from resolved customization. */

export function fontFamilyFor(_font) {
  return "var(--font-dm-sans), var(--font-sans), system-ui, sans-serif";
}

export function widgetStyleVars(customization) {
  const appearance = customization?.appearance || {};
  const primary = appearance.primaryColor || "#ea580c";
  const radius = Math.max(0, Math.min(28, appearance.cornerRadius ?? 16));
  const dark = appearance.theme === "dark";

  return {
    "--wc-primary": primary,
    "--wc-radius": `${radius}px`,
    "--wc-radius-panel": `${radius + 8}px`,
    "--wc-font": fontFamilyFor(appearance.font),
    "--wc-shell": dark ? "#0f172a" : "#ffffff",
    "--wc-shell-fg": dark ? "#f8fafc" : "#0f172a",
    "--wc-muted": dark ? "#94a3b8" : "#64748b",
    "--wc-border": dark
      ? "rgba(148,163,184,0.22)"
      : "rgba(15,23,42,0.08)",
    "--wc-chat-bg": dark ? "#020617" : "#ffffff",
    "--wc-input-bg": dark ? "#1e293b" : "#ffffff",
    "--wc-input-border": dark
      ? "rgba(148,163,184,0.28)"
      : `color-mix(in srgb, ${primary} 42%, #cbd5e1)`,
    "--wc-assistant-bg":
      appearance.messageStyle === "darker"
        ? dark
          ? "#334155"
          : "#0f172a"
        : dark
          ? "#1e293b"
          : "#f1f5f9",
    "--wc-assistant-fg":
      appearance.messageStyle === "darker" || dark ? "#f8fafc" : "#0f172a",
    "--wc-header-bg":
      appearance.headerStyle === "primary" ? primary : dark ? "#020617" : "#0f172a",
  };
}

export function widgetIntro(agent, customization) {
  const identity = customization?.identity || {};
  return {
    name: identity.displayName?.trim() || agent?.name || "Aide",
    description: identity.description?.trim() || agent?.description || "",
    avatarUrl: identity.avatarUrl || null,
  };
}

export function unlockNotificationAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!window.__hapyBeepCtx) {
      window.__hapyBeepCtx = new Ctx();
    }
    if (window.__hapyBeepCtx.state === "suspended") {
      window.__hapyBeepCtx.resume().catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function playNotificationBeep() {
  try {
    unlockNotificationAudio();
    const ctx = window.__hapyBeepCtx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore autoplay / unsupported
  }
}
