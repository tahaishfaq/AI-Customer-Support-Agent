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
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#f4f7fa]">
      <div className="flex items-center justify-between border-b border-black/[0.06] bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-primary)] text-[10px] font-semibold text-white">
            S
          </span>
          <span className="text-[13px] font-semibold text-slate-800">
            Storefront
          </span>
        </div>
        <div className="hidden items-center gap-5 text-[12px] text-slate-500 sm:flex">
          <span>Home</span>
          <span>Pricing</span>
          <span>Help</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            Sign in
          </span>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="h-3 w-24 rounded-full bg-white" />
        <div className="mt-4 h-8 w-2/3 rounded-lg bg-white shadow-sm" />
        <div className="mt-3 h-3 w-full rounded-full bg-white/90" />
        <div className="mt-2 h-3 w-5/6 rounded-full bg-white/80" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-xl bg-white shadow-sm" />
          <div className="h-28 rounded-xl bg-white shadow-sm" />
          <div className="h-28 rounded-xl bg-white shadow-sm" />
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
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[#eceff3] px-3 py-1.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex min-w-0 flex-1 items-center justify-center">
            <span className="truncate rounded-md bg-white px-3 py-0.5 text-center text-[11px] text-slate-500 shadow-sm ring-1 ring-black/[0.04]">
              https://yoursite.com
            </span>
          </span>
        </div>
        <div className="relative h-[calc(100%-34px)]">
          <FakeWebsite />
          <div
            className={cn(
              "absolute bottom-6 z-10",
              isLeft ? "left-6" : "right-6"
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
