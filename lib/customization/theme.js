/** Derive CSS variables + class tokens from resolved customization. */

export function fontFamilyFor(font) {
  if (font === "dm-sans") return "var(--font-sans), system-ui, sans-serif";
  if (font === "system") return "system-ui, sans-serif";
  return "var(--font-display), var(--font-sans), system-ui, sans-serif";
}

export function widgetStyleVars(customization) {
  const appearance = customization?.appearance || {};
  const primary = appearance.primaryColor || "#0b5f58";
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
    "--wc-chat-bg": dark ? "#020617" : "#f8fafc",
    "--wc-input-bg": dark ? "#1e293b" : "#ffffff",
    "--wc-assistant-bg":
      appearance.messageStyle === "darker"
        ? dark
          ? "#334155"
          : "#1e293b"
        : dark
          ? "#1e293b"
          : "#ffffff",
    "--wc-assistant-fg":
      appearance.messageStyle === "darker" || dark ? "#f8fafc" : "#0f172a",
    "--wc-header-bg":
      appearance.headerStyle === "primary" ? primary : dark ? "#020617" : "#0f172a",
  };
}

export function playNotificationBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    // ignore autoplay / unsupported
  }
}
