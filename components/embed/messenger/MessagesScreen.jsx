"use client";

import { ChevronRight, MessageSquareText, SendHorizontal } from "lucide-react";
import { formatRelative } from "@/components/conversations/format";
import { CloseButton, MessengerBrand } from "@/components/embed/messenger/MessengerParts";

export function MessagesScreen({ conversations = [], intro, identity, activeId, onOpen, onSendMessage, onClose, error = "" }) {
  const items = [...conversations].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ backgroundColor: "var(--wc-chat-bg)" }}>
      <header
        className="grid shrink-0 grid-cols-[2.25rem_1fr_2.25rem] items-center border-b px-3 py-3"
        style={{ borderColor: "var(--wc-border)", backgroundColor: "var(--wc-shell)" }}
      >
        <span aria-hidden />
        <h2 className="text-center text-[17px] font-semibold" style={{ color: "var(--wc-shell-fg)" }}>
          Messages
        </h2>
        <CloseButton onClose={onClose} />
      </header>

      {error ? (
        <p
          role="alert"
          className="shrink-0 border-b px-4 py-2 text-[13px]"
          style={{ borderColor: "var(--wc-border)", color: "#dc2626", backgroundColor: "color-mix(in srgb, #dc2626 8%, transparent)" }}
        >
          {error}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 pb-24 text-center">
            <MessageSquareText className="size-9" style={{ color: "var(--wc-shell-fg)" }} fill="currentColor" aria-hidden />
            <p className="mt-5 text-[19px] font-semibold" style={{ color: "var(--wc-shell-fg)" }}>
              No messages
            </p>
            <p className="mt-2 text-[14px]" style={{ color: "var(--wc-muted)" }}>
              Messages from the team will be shown here
            </p>
          </div>
        ) : (
          <ul className="pb-24">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2"
                  style={{
                    borderColor: "var(--wc-border)",
                    backgroundColor: item.id === activeId ? "color-mix(in srgb, var(--wc-primary) 7%, transparent)" : undefined,
                  }}
                >
                  <MessengerBrand avatarUrl={intro.avatarUrl} teamAvatars={[]} logoUrl={null} name={intro.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]" style={{ color: "var(--wc-shell-fg)" }}>
                      {item.preview || "Conversation"}
                    </span>
                    <span className="block text-[12px]" style={{ color: "var(--wc-muted)" }}>
                      {identity?.displayName || intro.name} · {formatRelative(item.updatedAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0" style={{ color: "var(--wc-muted)" }} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <button
            type="button"
            onClick={onSendMessage}
            className="pointer-events-auto inline-flex items-center gap-3 rounded-[calc(var(--wc-radius)-2px)] px-6 py-3 text-[15px] font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: "var(--wc-primary)", color: "var(--wc-primary-fg)" }}
          >
            Send us a message
            <SendHorizontal className="size-5" fill="currentColor" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
