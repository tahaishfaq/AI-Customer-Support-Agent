"use client";

import { ArrowLeft, History, MessageCircle, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetStyleVars } from "@/lib/customization/theme";

function monogram(name) {
  if (!name) return "H";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Avatar({ src, label, className }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        className
      )}
    >
      {monogram(label)}
    </span>
  );
}

export function ChatWidget({
  agent,
  customization,
  open = true,
  onToggle,
  align = "end",
  fullPage = false,
  historyOpen = false,
  onHistoryToggle,
  children,
}) {
  const identity = customization?.identity || {};
  const appearance = customization?.appearance || {};
  const deploy = customization?.deploy || {};
  const features = customization?.features || {};

  const displayName =
    identity.displayName?.trim() || agent?.name || "Hapy";
  const showHistory =
    features.conversationHistory !== false &&
    typeof onHistoryToggle === "function";
  const vars = widgetStyleVars(customization);
  const primary = appearance.primaryColor || "var(--color-primary)";

  const launcherSrc = deploy.useBotAvatar
    ? identity.avatarUrl
    : deploy.buttonImageUrl;
  const customLauncher = deploy.chatLauncher === "custom";
  const proactive =
    !open &&
    deploy.proactiveEnabled &&
    (deploy.proactiveMessage || "Hi! Need help?");

  const panel = (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border shadow-2xl",
        fullPage
          ? "h-full w-full rounded-none"
          : "h-[min(480px,calc(100svh-16rem))] w-[420px] min-w-[420px] max-w-[420px]"
      )}
      style={{
        ...vars,
        borderColor: "var(--wc-border)",
        backgroundColor: "var(--wc-shell)",
        color: "var(--wc-shell-fg)",
        fontFamily: "var(--wc-font)",
        borderRadius: fullPage ? 0 : "var(--wc-radius-panel)",
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 py-2.5 text-white"
        style={{ backgroundColor: "var(--wc-header-bg)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar
            src={identity.avatarUrl}
            label={displayName}
            className="size-8 rounded-full bg-white/15 text-[11px] text-white"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-white/80">
              <span className="size-1.5 rounded-full bg-emerald-300" />
              {historyOpen ? "Chat history" : "Online"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showHistory ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onHistoryToggle();
              }}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-lg text-white",
                "bg-white/20 ring-1 ring-white/25 hover:bg-white/30",
                historyOpen &&
                  "bg-white text-[var(--color-primary)] ring-0 hover:bg-white"
              )}
              style={
                historyOpen
                  ? { color: primary }
                  : undefined
              }
              aria-label={historyOpen ? "Back to chat" : "Open chat history"}
              aria-pressed={historyOpen}
              title={historyOpen ? "Back to chat" : "History"}
            >
              {historyOpen ? (
                <ArrowLeft className="size-3.5 shrink-0" />
              ) : (
                <History className="size-3.5 shrink-0" />
              )}
            </button>
          ) : null}

          {!fullPage && onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg p-1.5 text-white/90 hover:bg-white/15"
              aria-label="Minimize chat"
              title="Minimize"
            >
              <Minus className="size-4" />
            </button>
          ) : null}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );

  if (fullPage) return panel;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "start" ? "items-start" : "items-end"
      )}
      style={vars}
    >
      {open ? panel : null}

      {proactive ? (
        <div className="flex max-w-[260px] items-start gap-2 rounded-xl bg-white p-2.5 shadow-md ring-1 ring-black/5">
          <div
            className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: primary }}
          >
            {identity.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={identity.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              monogram(displayName)
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-slate-800">{proactive}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              a few moments ago
            </p>
          </div>
        </div>
      ) : null}

      {customLauncher ? (
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 shadow-md"
          aria-label={open ? "Close chat widget" : "Open chat widget"}
        >
          {open ? "Close chat" : "Chat with us"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="flex size-14 items-center justify-center overflow-hidden rounded-full text-white shadow-lg"
          style={{
            backgroundColor: primary,
            boxShadow: `0 10px 25px ${primary}40`,
          }}
          aria-label={open ? "Close chat widget" : "Open chat widget"}
        >
          {open ? (
            <X className="size-5" />
          ) : launcherSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={launcherSrc} alt="" className="size-full object-cover" />
          ) : (
            <MessageCircle className="size-5" />
          )}
        </button>
      )}
    </div>
  );
}
