"use client";

import { AideLogoMark } from "@/components/brand/AideLogo";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: {
    wrap: "size-10",
    logo: "h-3.5",
    ring: "border-[1.5px]",
  },
  md: {
    wrap: "size-14",
    logo: "h-4",
    ring: "border-2",
  },
  lg: {
    wrap: "size-20",
    logo: "h-6",
    ring: "border-[2.5px]",
  },
};

/**
 * Brand loader — AIDE wordmark with a soft primary ring.
 * Use for page loads, uploads, and empty waiting states (not tiny button icons).
 */
export function AideLoader({
  size = "md",
  label = "Loading",
  className,
  showLabel = false,
  variant = "auto",
}) {
  const tokens = SIZE[size] || SIZE.md;

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center gap-3",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className={cn(
          "aide-loader-ring relative inline-flex items-center justify-center rounded-2xl",
          tokens.wrap
        )}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-2xl border-transparent",
            tokens.ring,
            "aide-loader-orbit"
          )}
          aria-hidden
        />
        <AideLogoMark
          variant={variant}
          size="sm"
          className={cn(tokens.logo, "aide-loader-mark relative z-[1]")}
          title="AIDE"
          priority={false}
        />
      </span>
      {showLabel ? (
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

export default AideLoader;
