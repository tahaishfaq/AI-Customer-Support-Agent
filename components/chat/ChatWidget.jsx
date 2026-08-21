"use client";

import { ArrowLeft, History, MessageCircle, Minus, RotateCcw } from "lucide-react";
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

function Avatar({ src, label, className, style }) {
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
      style={style}
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
  fillHost = false,
  historyOpen = false,
  onHistoryToggle,
  onReset,
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
        "flex min-h-0 flex-col overflow-hidden border-0 shadow-none outline-none ring-0",
        fullPage
          ? "h-full w-full rounded-none"
          : "h-[min(520px,calc(100svh-6rem))] w-[min(380px,calc(100vw-1.5rem))]"
      )}
      style={{
        ...vars,
        border: "none",
        outline: "none",
        overflow: "hidden",
        isolation: "isolate",
        backgroundColor: "var(--wc-shell)",
        color: "var(--wc-shell-fg)",
        fontFamily: "var(--wc-font)",
        borderRadius: fullPage ? 0 : "var(--wc-radius-panel)",
        boxShadow: fullPage
          ? "none"
          : "0 12px 40px rgba(15,23,42,0.12)",
        clipPath: fullPage ? undefined : "inset(0 round var(--wc-radius-panel))",
      }}
    >
      <header
        className="flex shrink-0 items-center gap-2 border-0 px-3 py-2.5 text-white shadow-none"
        style={{ backgroundColor: "var(--wc-header-bg)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar
            src={identity.avatarUrl}
            label={displayName}
            className="size-7 rounded-full text-[11px] font-semibold"
            style={
              identity.avatarUrl
                ? undefined
                : { backgroundColor: "#ffffff", color: primary }
            }
          />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {historyOpen ? "Chat history" : displayName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {showHistory ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onHistoryToggle();
              }}
              className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
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

          {onReset ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReset();
              }}
              className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="New chat"
              title="New chat"
            >
              <RotateCcw className="size-3.5 shrink-0" />
            </button>
          ) : null}

          {!fullPage && onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Minimize chat"
              title="Minimize"
            >
              <Minus className="size-4" />
            </button>
          ) : null}
        </div>
      </header>
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ backgroundColor: "var(--wc-chat-bg)" }}
      >
        {children}
      </div>
    </div>
  );

  if (fullPage) return panel;

  return (
    <div
      className={cn(
        "flex w-fit flex-col gap-3",
        fillHost ? "ml-auto mt-auto" : "",
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
          className="rounded-full border-0 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 shadow-none outline-none"
          aria-label={open ? "Close chat widget" : "Open chat widget"}
        >
          {open ? "Close chat" : "Chat with us"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="flex size-14 items-center justify-center overflow-hidden rounded-full border-0 text-white shadow-none outline-none"
          style={{
            backgroundColor: primary,
            boxShadow: "none",
          }}
          aria-label={open ? "Close chat widget" : "Open chat widget"}
        >
          {open ? (
            <MessageCircle className="size-5" />
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
