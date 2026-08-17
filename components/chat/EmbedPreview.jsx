"use client";

import { cn } from "@/lib/utils";

export const EMBED_PLACEMENTS = [
  {
    id: "bottom-right",
    label: "Bottom right",
    hint: "Default bubble on your website",
  },
  {
    id: "bottom-left",
    label: "Bottom left",
    hint: "Same widget, left corner",
  },
  {
    id: "full-page",
    label: "Full page",
    hint: "Standalone chat page",
  },
];

function FakeWebsite() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#eef2f6]">
      <div className="border-b border-black/5 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="size-6 rounded-md bg-[var(--color-primary)]/15" />
          <span className="h-2.5 w-24 rounded-full bg-slate-200" />
          <span className="ml-auto hidden h-2.5 w-14 rounded-full bg-slate-200 sm:block" />
          <span className="hidden h-2.5 w-14 rounded-full bg-slate-200 sm:block" />
          <span className="hidden h-2.5 w-14 rounded-full bg-slate-200 sm:block" />
        </div>
      </div>
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
  );
}

export function EmbedPreview({ placement, children }) {
  const isFull = placement === "full-page";
  const isLeft = placement === "bottom-left";

  if (isFull) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg)]">
        {children}
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="absolute inset-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] bg-[#f1f5f9] px-3 py-2">
          <span className="size-2 rounded-full bg-[#fca5a5]" />
          <span className="size-2 rounded-full bg-[#fcd34d]" />
          <span className="size-2 rounded-full bg-[#86efac]" />
          <span className="ml-3 truncate rounded-md bg-white px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
            yoursite.com
          </span>
        </div>
        <div className="relative h-[calc(100%-36px)]">
          <FakeWebsite />
          <div
            className={cn(
              "absolute bottom-4 z-10",
              isLeft ? "left-4" : "right-4"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlacementSwitcher({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[var(--color-bg)] p-1">
      {EMBED_PLACEMENTS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.hint}
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[12px] font-medium",
            value === item.id
              ? "bg-white text-[var(--color-text)] shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
