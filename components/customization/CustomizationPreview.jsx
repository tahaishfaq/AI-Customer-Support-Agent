"use client";

import { useState } from "react";
import {
  History,
  Maximize2,
  MessageCircle,
  PanelBottom,
  Paperclip,
  RotateCcw,
  Send,
  ThumbsUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AvatarImage } from "@/components/ui/avatar-image";

const PLACEMENTS = [
  {
    id: "bottom-left",
    label: "Left bottom",
    icon: PanelBottom,
  },
  {
    id: "bottom-right",
    label: "Right bottom",
    icon: PanelBottom,
  },
  {
    id: "full-page",
    label: "Full page",
    icon: Maximize2,
  },
];

function PlacementPicker({ value, onChange, className }) {
  return (
    <div className={cn("grid grid-cols-3 gap-1.5", className)}>
      {PLACEMENTS.map((item) => {
        const Icon = item.icon;
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-colors",
              selected
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.06] text-[var(--color-primary)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-bg)]"
            )}
          >
            <Icon
              className={cn(
                "size-3.5",
                selected ? "text-[var(--color-primary)]" : "text-[var(--color-primary)]",
                item.id === "bottom-left" && "-scale-x-100"
              )}
            />
            <span className="text-[10px] font-medium leading-tight">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function monogram(name) {
  if (!name) return "A";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

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
      className={`flex w-full min-w-[280px] flex-col overflow-hidden border shadow-[0_12px_40px_rgba(15,23,42,0.12)] ${className}`}
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

      {/* min-h-0 + overflow so max-height never lets bubbles bleed into the composer */}
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
                <div
                  className="mt-1 flex gap-1.5"
                  style={{ color: muted }}
                >
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
        className="shrink-0 px-3 pb-2 text-center text-[10px]"
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
  const footer = identity.footer || "by Hapy";
  const primary = appearance.primaryColor || "#0b5f58";
  const radius = Math.max(0, Math.min(28, appearance.cornerRadius ?? 16));
  const embedded = deploy.chatInterface === "embedded";
  const proactive =
    !embedded &&
    deploy.proactiveEnabled &&
    (deploy.proactiveMessage || "Hi! Need help?");

  const [placement, setPlacement] = useState(null);

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

  const bubbleStack = (
    <div
      className={cn(
        "flex flex-col gap-3",
        placement === "bottom-left" ? "items-start" : "items-end"
      )}
    >
      <ChatWindow
        {...windowProps}
        className="h-[min(420px,52vh)] w-[320px] max-w-[calc(100vw-3rem)]"
      />
      {proactive ? (
        <div className="flex max-w-[260px] items-start gap-2 rounded-xl bg-white p-2.5 shadow-md ring-1 ring-black/5">
          <Avatar
            src={identity.avatarUrl}
            label={label}
            sizeClass="size-7 text-[10px]"
            primary={primary}
          />
          <div className="min-w-0">
            <p className="text-[12px] text-slate-800">{proactive}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">a few moments ago</p>
          </div>
        </div>
      ) : null}
      {launcher}
    </div>
  );

  const siteChrome = (
    <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[#f1f5f9] px-3 py-2">
      <span className="size-2 rounded-full bg-[#fca5a5]" />
      <span className="size-2 rounded-full bg-[#fcd34d]" />
      <span className="size-2 rounded-full bg-[#86efac]" />
      <span className="ml-3 truncate rounded-md bg-white px-2 py-0.5 text-[11px] text-[var(--color-muted)] ring-1 ring-[var(--color-border)]">
        yoursite.com
      </span>
    </div>
  );

  const siteBody = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-lg">
        <div className="h-3 w-24 rounded-full bg-white/90" />
        <div className="mt-4 h-7 w-3/4 max-w-sm rounded-lg bg-white" />
        <div className="mt-3 h-2.5 w-full rounded-full bg-white/75" />
        <div className="mt-2 h-2.5 w-5/6 rounded-full bg-white/75" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded-xl bg-white/95 shadow-sm" />
          <div className="h-24 rounded-xl bg-white/80 shadow-sm" />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Live preview — reads as a real site + widget, not a toy grid */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        {siteChrome}
        <div className="relative min-h-[520px] bg-[#eef2f6]">
          {siteBody}
          {embedded ? (
            <div className="relative z-10 flex min-h-[520px] p-3 sm:p-4">
              <ChatWindow {...windowProps} className="max-w-none flex-1" />
            </div>
          ) : (
            <div className="absolute bottom-4 right-4 z-10 flex max-w-[calc(100%-2rem)] flex-col items-end gap-3">
              <ChatWindow
                {...windowProps}
                className="h-[380px] w-[320px] max-w-full"
              />
              {proactive ? (
                <div className="flex max-w-[240px] items-start gap-2 rounded-xl bg-white p-2.5 shadow-md ring-1 ring-black/5">
                  <Avatar
                    src={identity.avatarUrl}
                    label={label}
                    sizeClass="size-7 text-[10px]"
                    primary={primary}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] text-slate-800">{proactive}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      a few moments ago
                    </p>
                  </div>
                </div>
              ) : null}
              {launcher}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] font-medium text-[var(--color-muted)]">
        How the widget sits on a customer site
      </p>
      <PlacementPicker
        className="mt-1.5"
        value={placement}
        onChange={setPlacement}
      />

      <Dialog
        open={Boolean(placement)}
        onOpenChange={(open) => {
          if (!open) setPlacement(null);
        }}
      >
        <DialogContent
          className="flex max-h-[min(88vh,820px)] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
          showCloseButton
        >
          <DialogHeader className="px-5 py-3.5 pr-12 text-left">
            <DialogTitle>
              {PLACEMENTS.find((p) => p.id === placement)?.label || "Preview"}
            </DialogTitle>
            <DialogDescription>
              How the chat sits on a website. Switch placements below — style
              still follows your live preview on the right.
            </DialogDescription>
          </DialogHeader>
          <div className="border-y border-[var(--color-border)] px-5 py-2.5">
            <PlacementPicker value={placement} onChange={setPlacement} />
          </div>

          <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-4">
            {placement === "full-page" ? (
              <div className="flex h-[min(70vh,640px)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
                <ChatWindow
                  {...windowProps}
                  className="max-w-none flex-1 rounded-none shadow-none"
                />
              </div>
            ) : (
              <div className="relative h-[min(70vh,640px)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
                <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[#f1f5f9] px-3 py-2">
                  <span className="size-2 rounded-full bg-[#fca5a5]" />
                  <span className="size-2 rounded-full bg-[#fcd34d]" />
                  <span className="size-2 rounded-full bg-[#86efac]" />
                  <span className="ml-3 truncate rounded-md bg-white px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                    yoursite.com
                  </span>
                </div>
                <div className="relative h-[calc(100%-36px)] bg-[#eef2f6]">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="mx-auto max-w-3xl px-6 py-8">
                      <div className="h-8 w-2/3 rounded-lg bg-white" />
                      <div className="mt-3 h-3 w-full rounded-full bg-white/80" />
                      <div className="mt-2 h-3 w-5/6 rounded-full bg-white/80" />
                      <div className="mt-8 grid gap-4 sm:grid-cols-3">
                        <div className="h-28 rounded-xl bg-white" />
                        <div className="h-28 rounded-xl bg-white" />
                        <div className="h-28 rounded-xl bg-white" />
                      </div>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "absolute bottom-4 z-10",
                      placement === "bottom-left" ? "left-4" : "right-4"
                    )}
                  >
                    {bubbleStack}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

