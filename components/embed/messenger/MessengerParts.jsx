"use client";

import { House, MessageSquareText, X } from "lucide-react";
import { monogram } from "@/components/conversations/format";
import { cn } from "@/lib/utils";

/** Company logo (white-label) or AIDE mark, then the agent + team avatars stacked. */
export function MessengerBrand({ logoUrl, avatarUrl, teamAvatars = [], name, size = "md", onDark = false }) {
  const avatarSize = size === "lg" ? "size-12" : "size-8";
  const avatars = [avatarUrl, ...teamAvatars].filter(Boolean).slice(0, 3);
  return (
    <span className="flex min-w-0 items-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={name}
          className={cn("mr-2 w-auto max-w-[9rem] shrink-0 object-contain", size === "lg" ? "h-12" : "h-8")}
        />
      ) : null}
      {avatars.length ? (
        <span className="flex shrink-0 -space-x-2.5">
          {avatars.map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${src}-${index}`}
              src={src}
              alt=""
              className={cn(avatarSize, "rounded-full object-cover ring-2")}
              style={{ "--tw-ring-color": onDark ? "var(--wc-primary)" : "var(--wc-shell)" }}
            />
          ))}
        </span>
      ) : !logoUrl ? (
        <span
          className={cn(avatarSize, "flex shrink-0 items-center justify-center rounded-full text-sm font-semibold")}
          style={{
            backgroundColor: onDark ? "color-mix(in srgb, var(--wc-primary-fg) 18%, transparent)" : "var(--wc-primary)",
            color: "var(--wc-primary-fg)",
          }}
          aria-hidden
        >
          {monogram(name)}
        </span>
      ) : null}
    </span>
  );
}

export function CloseButton({ onClose, onDark = false }) {
  if (typeof onClose !== "function") return null;
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close chat"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ color: onDark ? "var(--wc-primary-fg)" : "var(--wc-shell-fg)" }}
    >
      <X className="size-5" aria-hidden />
    </button>
  );
}

const TABS = [
  { id: "home", label: "Home", Icon: House },
  { id: "messages", label: "Messages", Icon: MessageSquareText },
];

export function MessengerTabBar({ active, onChange }) {
  return (
    <nav
      className="grid shrink-0 grid-cols-2 border-t"
      style={{ borderColor: "var(--wc-border)", backgroundColor: "var(--wc-shell)" }}
      aria-label="Chat navigation"
    >
      {TABS.map(({ id, label, Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={selected ? "page" : undefined}
            className="flex flex-col items-center gap-1 py-2.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
            style={{
              color: selected ? "var(--wc-shell-fg)" : "var(--wc-muted)",
              fontWeight: selected ? 600 : 400,
            }}
          >
            <Icon className="size-[22px]" strokeWidth={selected ? 2.2 : 1.8} fill={selected ? "currentColor" : "none"} fillOpacity={selected ? 0.12 : 0} aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
