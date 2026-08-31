"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SCORES = [1, 2, 3, 4, 5];

/**
 * Optional 1–5 CSAT after desk Return to AI / Resolve & close (embed).
 */
export function CsatPrompt({
  busy = false,
  onRate,
  onSkip,
  className,
}) {
  return (
    <div
      className={cn(
        "mx-2 mt-2 rounded-lg border border-[var(--wc-primary)]/20 bg-[var(--wc-primary)]/8 px-3 py-2.5",
        className
      )}
      style={{ color: "var(--wc-shell-fg)" }}
      role="group"
      aria-label="Rate your support experience"
    >
      <p className="text-[12px] font-medium">How was your support experience?</p>
      <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
        Optional — 1 is poor, 5 is excellent.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {SCORES.map((n) => (
          <Button
            key={n}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="h-8 min-w-8 px-2 text-[12px] transition-none"
            onClick={() => onRate?.(n)}
            aria-label={`Rate ${n} out of 5`}
          >
            {n}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          className="h-8 text-[11px] text-[var(--wc-muted)] transition-none"
          onClick={() => onSkip?.()}
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
