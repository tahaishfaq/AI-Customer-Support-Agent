"use client";

import { ChevronLeft, Ellipsis, Maximize2, Minimize2, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CloseButton, MessengerBrand } from "@/components/embed/messenger/MessengerParts";

export function ConversationHeader({
  intro,
  identity,
  onBack,
  onClose,
  onNewConversation,
  allowExpand = true,
  expanded = false,
  onToggleExpand,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointer(event) {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    menuRef.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [menuOpen]);

  const items = [
    allowExpand && typeof onToggleExpand === "function"
      ? { id: "expand", label: expanded ? "Collapse window" : "Expand window", Icon: expanded ? Minimize2 : Maximize2, run: onToggleExpand }
      : null,
    typeof onNewConversation === "function"
      ? { id: "new", label: "Start new conversation", Icon: SquarePen, run: onNewConversation }
      : null,
  ].filter(Boolean);

  return (
    <header
      className="relative flex shrink-0 items-center gap-2 border-b px-3 py-2.5"
      style={{ borderColor: "var(--wc-border)", backgroundColor: "var(--wc-shell)", color: "var(--wc-shell-fg)" }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <MessengerBrand
          logoUrl={identity?.logoUrl}
          avatarUrl={intro.avatarUrl}
          teamAvatars={identity?.teamAvatars}
          name={intro.name}
        />
        <span className="truncate text-[15px] font-semibold">{intro.name}</span>
      </span>
      {items.length ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={menuOpen ? { backgroundColor: "color-mix(in srgb, var(--wc-shell-fg) 10%, transparent)" } : undefined}
        >
          <Ellipsis className="size-5" aria-hidden />
        </button>
      ) : null}
      <CloseButton onClose={onClose} />

      {menuOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-12 top-full z-40 mt-1 min-w-[12rem] overflow-hidden rounded-xl border p-1 shadow-[0_10px_30px_rgba(15,23,42,0.16)]"
          style={{ backgroundColor: "var(--wc-shell)", borderColor: "var(--wc-border)", color: "var(--wc-shell-fg)" }}
        >
          {items.map(({ id, label, Icon, run }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                run();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none"
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}
