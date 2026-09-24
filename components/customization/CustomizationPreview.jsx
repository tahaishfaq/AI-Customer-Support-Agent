"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  normalizeWidgetPosition,
  positionToPreviewClasses,
} from "@/lib/customization/position";
import { monogram } from "@/components/conversations/format";
import { widgetIntro, widgetStyleVars } from "@/lib/customization/theme";
import { HomeScreen } from "@/components/embed/messenger/HomeScreen";
import { MessagesScreen } from "@/components/embed/messenger/MessagesScreen";
import { ConversationHeader } from "@/components/embed/messenger/ConversationHeader";
import { MessengerTabBar } from "@/components/embed/messenger/MessengerParts";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { WidgetLauncher } from "@/components/chat/WidgetLauncher";

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

const SAMPLE_CONVERSATIONS = [
  { id: "sample-1", preview: "Thanks! That fixed my login issue.", updatedAt: new Date(Date.now() - 3 * 60_000).toISOString() },
  { id: "sample-2", preview: "Do you ship to Canada?", updatedAt: new Date(Date.now() - 26 * 3_600_000).toISOString() },
];

/** Real Messenger screens with sample content — what visitors see. */
function MessengerPreviewPanel({ agent, customization, screen, onScreen, className }) {
  const identity = customization?.identity || {};
  const features = customization?.features || {};
  const intro = widgetIntro(agent, customization);
  const hideFooter = customization?.branding?.hideAideBranding && identity.footer === "by AIDE";
  const noop = () => {};
  return (
    <div
      className={cn("flex min-h-0 flex-col overflow-hidden shadow-[0_12px_40px_rgba(15,23,42,0.18)]", className)}
      style={{
        ...widgetStyleVars(customization),
        backgroundColor: "var(--wc-shell)",
        color: "var(--wc-shell-fg)",
        fontFamily: "var(--wc-font)",
        borderRadius: "var(--wc-radius-panel)",
      }}
    >
      {screen === "home" ? (
        <HomeScreen
          customization={customization}
          intro={intro}
          onSendMessage={() => onScreen("conversation")}
          onClose={noop}
          recentConversation={features.conversationHistory === false ? null : SAMPLE_CONVERSATIONS[0]}
          onOpenConversation={() => onScreen("conversation")}
          onSeeAll={() => onScreen("messages")}
        />
      ) : screen === "messages" ? (
        <MessagesScreen
          conversations={features.conversationHistory === false ? [] : SAMPLE_CONVERSATIONS}
          intro={intro}
          identity={identity}
          onOpen={() => onScreen("conversation")}
          onSendMessage={() => onScreen("conversation")}
          onClose={noop}
        />
      ) : (
        <>
          <ConversationHeader
            intro={intro}
            identity={identity}
            onBack={() => onScreen("home")}
            onClose={noop}
            onNewConversation={noop}
            allowExpand={customization?.deploy?.allowExpand !== false}
            onToggleExpand={noop}
          />
          {identity.conversationIntro ? (
            <p className="shrink-0 px-6 pt-3 text-center text-[13px]" style={{ color: "var(--wc-muted)" }}>
              {identity.conversationIntro}
            </p>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3" style={{ backgroundColor: "var(--wc-chat-bg)" }}>
            <MessageBubble role="ASSISTANT" content={agent?.welcomeMessage || "Hi! How can I help you today?"} themed identity={intro} showResponseTime={false} />
            <MessageBubble role="USER" content="How do I reset my password?" themed identity={intro} />
            <MessageBubble role="ASSISTANT" content="Go to **Settings → Security** and choose *Reset password*. You'll get an email link in a minute." themed identity={intro} showResponseTime={false} />
          </div>
          <ChatComposer
            variant="messenger"
            themed
            compact
            onSend={noop}
            placeholder={identity.messagePlaceholder || "Type your message..."}
            allowFileUpload={features.fileUpload}
            footer={hideFooter ? null : identity.footer || "by AIDE"}
          />
        </>
      )}
      {screen !== "conversation" ? <MessengerTabBar active={screen} onChange={onScreen} /> : null}
    </div>
  );
}

export function CustomizationPreview({ agent, customization }) {
  const identity = customization?.identity || {};
  const appearance = customization?.appearance || {};
  const deploy = customization?.deploy || {};
  const dark = appearance.theme === "dark";

  const label = identity.displayName?.trim() || agent?.name || "Agent";
  const primary = appearance.primaryColor || "#ea580c";
  const previewShell = dark ? "#111318" : "#ffffff";
  const previewStage = dark ? "#20252d" : "#e8eef3";
  const previewBorder = dark
    ? "rgba(148,163,184,0.22)"
    : "rgba(15,23,42,0.12)";
  const previewMuted = dark ? "#a8afbd" : "#64748b";
  const embedded = deploy.chatInterface === "embedded";
  const widgetPosition = normalizeWidgetPosition(deploy.widgetPosition);
  const previewPos = positionToPreviewClasses(widgetPosition);
  const proactiveMessage =
    deploy.proactiveMessage?.trim() || "Hi! Need help?";
  const proactiveOn = !embedded && deploy.proactiveEnabled;

  // Open vs closed: never stack panel + proactive + launcher (real widget doesn't).
  const [panelOpen, setPanelOpen] = useState(true);

  const [screen, setScreen] = useState("home");
  const styleVars = widgetStyleVars(customization);

  const launcher = <WidgetLauncher customization={customization} preview aria-label="Launcher preview" />;

  const closedStack = (
    <div
      className={cn(
        "flex max-w-[min(100%,260px)] flex-col gap-3",
        previewPos.items
      )}
      style={styleVars}
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
    <MessengerPreviewPanel
      agent={agent}
      customization={customization}
      screen={screen}
      onScreen={setScreen}
      className="h-[min(560px,64vh)] w-[min(100%,380px)]"
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
            <div className="flex rounded-md border p-0.5 text-[11px]" style={{ borderColor: previewBorder }} role="group" aria-label="Preview screen">
              {[
                ["home", "Home"],
                ["messages", "Messages"],
                ["conversation", "Chat"],
              ].map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setScreen(id);
                    setPanelOpen(true);
                  }}
                  aria-pressed={panelOpen && screen === id}
                  className="rounded px-2.5 py-1 text-[11px] outline-none transition-colors"
                  style={{
                    color: panelOpen && screen === id ? primary : previewMuted,
                    border: `1px solid ${panelOpen && screen === id ? primary : "transparent"}`,
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
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
              <MessengerPreviewPanel
                agent={agent}
                customization={customization}
                screen={screen}
                onScreen={setScreen}
                className="h-[520px] max-w-none flex-1"
              />
            </div>
          ) : panelOpen ? (
            <div className="relative z-10 flex min-h-[480px] items-center justify-center p-5 sm:p-6">
              {openPanel}
            </div>
          ) : (
            <div className={cn(previewPos.container, "overflow-visible")}>
              {closedStack}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
