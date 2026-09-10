"use client";

import { useState } from "react";
import {
  Globe2,
  MessageCircle,
  Plus,
  Send,
  Smile,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  normalizeWidgetPosition,
  positionToPreviewClasses,
} from "@/lib/customization/position";
import { monogram } from "@/components/conversations/format";
import { WidgetBrand } from "@/components/chat/WidgetBrand";

function fontFamily(_font) {
  return "var(--font-dm-sans), var(--font-sans), sans-serif";
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
  agent,
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

  const shellBg = dark ? "#0f172a" : "#ffffff";
  const shellFg = dark ? "#f8fafc" : "#0f172a";
  const muted = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.08)";
  const inputBg = dark ? "#1e293b" : "#ffffff";

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
        className="flex shrink-0 items-center gap-2 border-b px-3.5 py-3"
        style={{
          backgroundColor: shellBg,
          borderColor: border,
          color: shellFg,
        }}
      >
        <WidgetBrand
          src={identity.avatarUrl}
          label={label}
          className={identity.avatarUrl ? "size-8" : undefined}
          dark={dark}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-lg",
            agent?.webSearchEnabled ? "text-emerald-500" : "text-slate-400"
          )}
          title={agent?.webSearchEnabled ? "Web search on" : "Web search off"}
          aria-label={agent?.webSearchEnabled ? "Web search on" : "Web search off"}
        >
          <Globe2 className="size-[18px]" aria-hidden />
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4">
        <p
          className="max-w-[92%] px-1 text-[15px] leading-snug"
          style={{ color: shellFg }}
        >
          {identity.description || "Smart chatbots tailored to your knowledge and tools."}
        </p>

        <div className="mt-auto flex flex-col gap-2 pb-1">
          <div
            className="ml-auto max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-snug"
            style={{
              backgroundColor: dark ? "#334155" : "#f1f0ed",
              color: shellFg,
            }}
          >
            <span style={{ color: muted }}>Visitor · </span>
            Where is my order #4821?
          </div>
          <div
            className="flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]"
            style={{ borderColor: border, color: muted }}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: primary }}
              aria-hidden
            />
            GET_ORDER_STATUS
          </div>
          <div
            className="rounded-2xl border px-3.5 py-2.5 text-[12px] leading-snug shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
            style={{
              backgroundColor: shellBg,
              borderColor: border,
              color: shellFg,
            }}
          >
            <span style={{ color: primary }}>{label} · </span>
            Order #4821 is out for delivery — arrives tomorrow by 6pm.
          </div>
          {features?.messageFeedback ? (
            <div className="flex gap-1.5 px-1" style={{ color: muted }}>
              <ThumbsUp className="size-3" />
              <ThumbsUp className="size-3 rotate-180" />
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-2 bg-inherit px-3 py-2"
        style={{
          borderTop: `1px solid ${border}`,
          backgroundColor: shellBg,
        }}
      >
        {features?.fileUpload ? (
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full"
            style={{ color: muted }}
            aria-label="Attach file"
          >
            <Plus className="size-[20px]" strokeWidth={1.8} />
          </span>
        ) : null}
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
        </div>
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ color: muted }}
          aria-label="Add emoji"
        >
          <Smile className="size-[18px]" strokeWidth={1.8} />
        </span>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#171313] text-white"
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
      className="flex size-12 shrink-0 items-center justify-center overflow-hidden text-white shadow-lg"
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
  const dark = appearance.theme === "dark";

  const label = identity.displayName?.trim() || agent?.name || "Agent";
  const placeholder = identity.messagePlaceholder || "Type your message...";
  const footer = identity.footer || "by AIDE";
  const primary = appearance.primaryColor || "#ea580c";
  const previewShell = dark ? "#111318" : "#ffffff";
  const previewStage = dark ? "#20252d" : "#e8eef3";
  const previewBorder = dark
    ? "rgba(148,163,184,0.22)"
    : "rgba(15,23,42,0.12)";
  const previewMuted = dark ? "#a8afbd" : "#64748b";
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
    agent,
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
        "flex max-w-[min(100%,260px)] flex-col gap-3",
        previewPos.items
      )}
    >
      {proactiveOn ? (
        <div
          className="flex w-full max-w-[220px] items-start gap-2.5 rounded-2xl bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-black/5"
          style={{ fontFamily: fontFamily(appearance.font) }}
        >
          <Avatar
            src={identity.avatarUrl}
            label={label}
            sizeClass="size-8 text-[10px]"
            primary={primary}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3 text-[12px] leading-snug text-slate-800">
              {proactiveMessage}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
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
      className="h-[min(420px,58vh)] w-[min(100%,380px)]"
    />
  );

  const siteBody = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
      <div className="max-w-[280px]">
        <div className="h-2.5 w-16 rounded-full bg-white/95" />
        <div className="mt-5 h-5 w-[70%] rounded-lg bg-white" />
        <div className="mt-4 space-y-2.5">
          <div className="h-2 w-full rounded-full bg-white/75" />
          <div className="h-2 w-[85%] rounded-full bg-white/70" />
          <div className="h-2 w-[60%] rounded-full bg-white/55" />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="h-[72px] rounded-xl bg-white shadow-sm" />
          <div className="h-[72px] rounded-xl bg-white/85 shadow-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 font-sans">
      <div
        className="overflow-hidden rounded-xl border shadow-[var(--shadow-card)]"
        style={{
          backgroundColor: previewShell,
          borderColor: previewBorder,
          color: dark ? "#f8fafc" : "#0f172a",
        }}
      >
        {!embedded ? (
          <div
            className="flex items-center justify-between gap-2 border-b px-3 py-2.5"
            style={{ borderColor: previewBorder }}
          >
            <p className="text-[11px]" style={{ color: previewMuted }}>
              {panelOpen ? "Panel open" : "Launcher closed"}
            </p>
            <div
              className="flex rounded-md border p-0.5 text-[11px]"
              style={{ borderColor: previewBorder }}
            >
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="rounded px-2.5 py-1 text-[11px] outline-none transition-colors"
                style={{
                  color: panelOpen ? primary : previewMuted,
                  border: `1px solid ${panelOpen ? primary : "transparent"}`,
                }}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded px-2.5 py-1 text-[11px] outline-none transition-colors"
                style={{
                  color: !panelOpen ? primary : previewMuted,
                  border: `1px solid ${!panelOpen ? primary : "transparent"}`,
                }}
              >
                Closed
              </button>
            </div>
          </div>
        ) : null}

        <div
          className="relative isolate min-h-[480px] overflow-hidden"
          style={{ backgroundColor: previewStage }}
        >
          {siteBody}
          {embedded ? (
            <div className="relative z-10 flex min-h-[480px] p-4 sm:p-5">
              <ChatWindow {...windowProps} className="max-w-none flex-1" />
            </div>
          ) : panelOpen ? (
            <div className="relative z-10 flex min-h-[480px] items-center justify-center p-5 sm:p-6">
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
