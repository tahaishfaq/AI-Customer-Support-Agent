"use client";

import { History, MessageCircle, Paperclip, RotateCcw, ThumbsUp } from "lucide-react";

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

function Avatar({ src, label, sizeClass, primary }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${sizeClass} shrink-0 object-cover`}
        style={{ borderRadius: "9999px" }}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-semibold text-white ${sizeClass}`}
      style={{ backgroundColor: primary, borderRadius: "9999px" }}
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
  const inputBg = dark ? "#1e293b" : "#f8fafc";
  const assistantBg = darkerBubbles
    ? dark
      ? "#334155"
      : "#1e293b"
    : dark
      ? "#1e293b"
      : "#f1f5f9";
  const assistantFg = darkerBubbles || dark ? "#f8fafc" : "#0f172a";
  const headerBg = headerPrimary ? primary : dark ? "#020617" : "#0f172a";

  return (
    <div
      className={`flex w-full flex-col overflow-hidden border shadow-[0_12px_40px_rgba(15,23,42,0.12)] ${className}`}
      style={{
        backgroundColor: shellBg,
        color: shellFg,
        borderColor: border,
        borderRadius: `${radius + 8}px`,
        fontFamily: fontFamily(appearance.font),
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ backgroundColor: headerBg, color: "#ffffff" }}
      >
        <Avatar
          src={identity.avatarUrl}
          label={label}
          sizeClass="size-7 text-[11px]"
          primary={primary}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {label}
        </span>
        {features?.conversationHistory ? (
          <History className="size-3.5 shrink-0 opacity-80" aria-hidden />
        ) : null}
        <RotateCcw className="size-3.5 shrink-0 opacity-80" aria-hidden />
      </div>

      <div className="flex min-h-[220px] flex-1 flex-col gap-2 px-3 py-4">
        <div className="mb-2 flex flex-col items-center gap-2 py-3">
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

        <div className="mt-auto flex flex-col gap-2">
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
          <div className="flex justify-end">
            <div
              className="max-w-[75%] px-3 py-2 text-[12px] text-white"
              style={{
                backgroundColor: primary,
                borderRadius: `${Math.max(8, radius)}px`,
              }}
            >
              I have a question
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${border}` }}>
        <div
          className="flex items-center gap-2 px-3 py-2.5 text-[13px]"
          style={{
            backgroundColor: inputBg,
            color: muted,
            border: `1px solid ${border}`,
            borderRadius: `${Math.max(8, radius)}px`,
          }}
        >
          <span className="min-w-0 flex-1 truncate">{placeholder}</span>
          {features?.fileUpload ? (
            <Paperclip className="size-3.5 shrink-0 opacity-80" aria-hidden />
          ) : null}
        </div>
        <p className="mt-2 text-center text-[10px]" style={{ color: muted }}>
          {footer}
        </p>
      </div>
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

  return (
    <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[linear-gradient(180deg,#e8eef3_0%,#dfe7ee_100%)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {embedded ? (
        <div className="relative z-10 flex flex-1 p-4 sm:p-5">
          <ChatWindow
            identity={identity}
            appearance={appearance}
            features={features}
            label={label}
            placeholder={placeholder}
            footer={footer}
            primary={primary}
            radius={radius}
            className="max-w-none flex-1"
          />
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-end justify-start gap-3 px-4 pb-5 pt-5 sm:px-5">
          <ChatWindow
            identity={identity}
            appearance={appearance}
            features={features}
            label={label}
            placeholder={placeholder}
            footer={footer}
            primary={primary}
            radius={radius}
            className="max-w-[320px]"
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
                <p className="mt-0.5 text-[10px] text-slate-400">
                  a few moments ago
                </p>
              </div>
            </div>
          ) : null}

          <LauncherButton
            deploy={deploy}
            identity={identity}
            primary={primary}
          />
        </div>
      )}
    </div>
  );
}
