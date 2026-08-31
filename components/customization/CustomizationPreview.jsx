"use client";

import { useState } from "react";
import {
  History,
  MessageCircle,
  Paperclip,
  RotateCcw,
  Send,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  normalizeWidgetPosition,
  positionToPreviewClasses,
} from "@/lib/customization/position";
import { monogram } from "@/components/conversations/format";

function fontFamily(font) {
  if (font === "dm-sans") return "var(--font-sans), system-ui, sans-serif";
  if (font === "system") return "system-ui, sans-serif";
  return "var(--font-display), var(--font-sans), system-ui, sans-serif";
}

function Avatar({ src, label, sizeClass, primary, invert = false, size = 28 }) {
  if (src) {
    return (
      <AvatarImage
        src={src}
        size={size}
        className={cn(sizeClass, "shrink-0 rounded-full")}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-semibold ${sizeClass}`}
      style={{
        backgroundColor: invert ? "#ffffff" : primary,
        color: invert ? primary : "#ffffff",
        borderRadius: "9999px",
      }}
    >
      {monogram(label)}
    </span>
  );
}

function ChatWindow({
  identity,
  appearance,
  features,
  label,
  placeholder,
  footer,
  primary,
  radius,
  className = "",
}) {
  const dark = appearance.theme === "dark";
  const headerPrimary = appearance.headerStyle === "primary";
  const darkerBubbles = appearance.messageStyle === "darker";

  const shellBg = dark ? "#0f172a" : "#ffffff";
  const shellFg = dark ? "#f8fafc" : "#0f172a";
  const muted = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.08)";
  const inputBg = dark ? "#1e293b" : "#ffffff";
  const assistantBg = darkerBubbles
    ? dark
      ? "#334155"
      : "#0f172a"
    : dark
      ? "#1e293b"
      : "#f1f5f9";
  const assistantFg = darkerBubbles || dark ? "#f8fafc" : "#0f172a";
  const headerBg = headerPrimary ? primary : dark ? "#020617" : "#0f172a";

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col overflow-hidden border shadow-[0_12px_40px_rgba(15,23,42,0.12)]",
        className
      )}
      style={{
        backgroundColor: shellBg,
        color: shellFg,
        borderColor: border,
        borderRadius: `${radius + 8}px`,
        fontFamily: fontFamily(appearance.font),
      }}
    >
      <div
        className="flex shrink-0 items-center gap-2 px-3 py-2.5"
        style={{ backgroundColor: headerBg, color: "#ffffff" }}
      >
        <Avatar
          src={identity.avatarUrl}
          label={label}
          sizeClass="size-7 text-[11px]"
          primary={primary}
          invert
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {label}
        </span>
        {features?.conversationHistory ? (
          <History className="size-3.5 shrink-0 opacity-80" aria-hidden />
        ) : null}
        <RotateCcw className="size-3.5 shrink-0 opacity-80" aria-hidden />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        <div className="mb-1 flex shrink-0 flex-col items-center gap-2 py-2">
          <Avatar
            src={identity.avatarUrl}
            label={label}
            sizeClass="size-14 text-lg"
            primary={primary}
          />
          <p className="text-sm font-semibold" style={{ color: shellFg }}>
            {label}
          </p>
          {identity.description ? (
            <p
              className="line-clamp-2 text-center text-[11px]"
              style={{ color: muted }}
            >
              {identity.description}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-2 pb-1">
          <div className="flex items-end gap-2">
            <Avatar
              src={identity.avatarUrl}
              label={label}
              sizeClass="size-6 text-[9px]"
              primary={primary}
            />
            <div className="min-w-0 max-w-[75%]">
              <div
                className="px-3 py-2 text-[12px]"
                style={{
                  backgroundColor: assistantBg,
                  color: assistantFg,
                  borderRadius: `${Math.max(8, radius)}px`,
                }}
              >
                Hi! How can I help you today?
              </div>
              {features?.messageFeedback ? (
                <div className="mt-1 flex gap-1.5" style={{ color: muted }}>
                  <ThumbsUp className="size-3" />
                  <ThumbsUp className="size-3 rotate-180" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-2 bg-inherit px-3 py-2"
        style={{
          borderTop: `1px solid ${border}`,
          backgroundColor: shellBg,
        }}
      >
        <div
          className="flex min-h-8 min-w-0 flex-1 items-center gap-1 overflow-hidden px-3 py-1 text-[13px]"
          style={{
            backgroundColor: inputBg,
            color: muted,
            border: `1px solid color-mix(in srgb, ${primary} 42%, #cbd5e1)`,
            borderRadius: "9999px",
          }}
        >
          <span className="min-w-0 flex-1 truncate">{placeholder}</span>
          <Paperclip className="size-3.5 shrink-0 opacity-70" aria-hidden />
        </div>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: primary }}
          aria-hidden
        >
          <Send className="size-3.5" />
        </span>
      </div>
      <p
        className="shrink-0 truncate px-3 pb-2 text-center text-[10px]"
        style={{ color: muted, backgroundColor: shellBg }}
      >
        {footer}
      </p>
    </div>
  );
}

function LauncherButton({ deploy, identity, primary }) {
  const src = deploy.useBotAvatar
    ? identity.avatarUrl
    : deploy.buttonImageUrl;

  if (deploy.chatLauncher === "custom") {
    return (
      <button
        type="button"
        className="rounded-full border border-black/10 bg-white px-4 py-2 text-[12px] font-medium text-slate-700 shadow-md"
        tabIndex={-1}
      >
        Chat with us
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex size-12 items-center justify-center overflow-hidden text-white shadow-lg"
      style={{ backgroundColor: primary, borderRadius: "9999px" }}
      aria-label="Chat launcher preview"
      tabIndex={-1}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <MessageCircle className="size-5" />
      )}
    </button>
  );
}

export function CustomizationPreview({ agent, customization }) {
  const identity = customization?.identity || {};
  const appearance = customization?.appearance || {};
  const deploy = customization?.deploy || {};
  const features = customization?.features || {};

  const label = identity.displayName?.trim() || agent?.name || "Agent";
  const placeholder = identity.messagePlaceholder || "Type your message...";
  const footer = identity.footer || "by Aide";
  const primary = appearance.primaryColor || "#0d7377";
  const radius = Math.max(0, Math.min(28, appearance.cornerRadius ?? 16));
  const embedded = deploy.chatInterface === "embedded";
  const widgetPosition = normalizeWidgetPosition(deploy.widgetPosition);
  const previewPos = positionToPreviewClasses(widgetPosition);
  const proactiveMessage =
    deploy.proactiveMessage?.trim() || "Hi! Need help?";
  const proactiveOn = !embedded && deploy.proactiveEnabled;

  // Open vs closed: never stack panel + proactive + launcher (real widget doesn't).
  const [panelOpen, setPanelOpen] = useState(true);

  const windowProps = {
    identity,
    appearance,
    features,
    label,
    placeholder,
    footer,
    primary,
    radius,
  };

  const launcher = (
    <LauncherButton deploy={deploy} identity={identity} primary={primary} />
  );

  const closedStack = (
    <div
      className={cn(
        "flex max-w-[min(100%,280px)] flex-col gap-2.5",
        previewPos.items
      )}
    >
      {proactiveOn ? (
        <div className="flex max-w-[240px] items-start gap-2 rounded-xl bg-white p-2.5 shadow-md ring-1 ring-black/5">
          <Avatar
            src={identity.avatarUrl}
            label={label}
            sizeClass="size-7 text-[10px]"
            primary={primary}
          />
          <div className="min-w-0">
            <p className="line-clamp-3 text-[12px] text-slate-800">
              {proactiveMessage}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              a few moments ago
            </p>
          </div>
        </div>
      ) : null}
      {launcher}
    </div>
  );

  const openPanel = (
    <ChatWindow
      {...windowProps}
      className="h-[min(420px,58vh)] w-[min(100%,320px)]"
    />
  );

  const siteBody = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
      <div className="mx-auto max-w-md opacity-90">
        <div className="h-2.5 w-20 rounded-full bg-white/95" />
        <div className="mt-4 h-6 w-2/3 max-w-xs rounded-lg bg-white" />
        <div className="mt-3 h-2 w-full rounded-full bg-white/70" />
        <div className="mt-2 h-2 w-4/5 rounded-full bg-white/70" />
        <div className="mt-2 h-2 w-3/5 rounded-full bg-white/55" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="h-20 rounded-xl bg-white/90 shadow-sm" />
          <div className="h-20 rounded-xl bg-white/70 shadow-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        {!embedded ? (
          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {panelOpen ? "Panel open" : "Launcher closed"}
            </p>
            <div className="flex rounded-md border border-[var(--color-border)] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className={cn(
                  "rounded px-2 py-1 transition-colors",
                  panelOpen
                    ? "bg-[#0d7377] text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className={cn(
                  "rounded px-2 py-1 transition-colors",
                  !panelOpen
                    ? "bg-[#0d7377] text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Closed
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative min-h-[480px] bg-[#e8eef3]">
          {siteBody}
          {embedded ? (
            <div className="relative z-10 flex min-h-[480px] p-3 sm:p-4">
              <ChatWindow {...windowProps} className="max-w-none flex-1" />
            </div>
          ) : panelOpen ? (
            <div className="relative z-10 flex min-h-[480px] items-center justify-center p-4 sm:p-6">
              {openPanel}
            </div>
          ) : (
            <div className={previewPos.container}>{closedStack}</div>
          )}
        </div>
      </div>
    </div>
  );
}
