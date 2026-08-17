"use client";

import { cn } from "@/lib/utils";

export function ChoiceCard({ selected, onClick, title, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-white text-left transition-colors",
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.04] ring-1 ring-[var(--color-primary)]"
          : "border-[var(--color-border)] hover:border-[var(--color-primary)]/40",
        className
      )}
    >
      <div className="flex min-h-[88px] flex-1 items-center justify-center bg-[var(--color-bg)]/70 p-3">
        {children}
      </div>
      <div className="border-t border-[var(--color-border)] px-3 py-2.5 text-center text-[13px] font-semibold text-[var(--color-text)]">
        {title}
      </div>
    </button>
  );
}

export function FieldBlock({ label, hint, children, className }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-4",
        className
      )}
    >
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[var(--color-text)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-muted)]">
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function FormSection({ title, children }) {
  return (
    <section className="space-y-2.5">
      {title ? (
        <p className="px-0.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--color-muted)] uppercase">
          {title}
        </p>
      ) : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function MiniLabel({ children }) {
  return (
    <p className="mb-1.5 text-[12px] font-medium text-[var(--color-muted)]">
      {children}
    </p>
  );
}

export const fieldClass =
  "h-11 rounded-xl border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-none focus-visible:ring-[var(--color-primary)]/20";

export const areaClass =
  "min-h-[88px] rounded-xl border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-none focus-visible:ring-[var(--color-primary)]/20";
