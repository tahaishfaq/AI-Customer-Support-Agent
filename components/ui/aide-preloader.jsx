"use client";

import { AideLoader } from "@/components/brand/AideLoader";
import { cn } from "@/lib/utils";

/**
 * Full-page or panel preloader with AIDE branding.
 * @param {"page"|"panel"|"inline"|"overlay"} [variant]
 */
export function AidePreloader({
  variant = "page",
  label = "Loading…",
  className,
  size,
}) {
  const resolvedSize =
    size || (variant === "inline" ? "sm" : variant === "panel" ? "md" : "lg");

  if (variant === "inline") {
    return (
      <AideLoader
        size={resolvedSize}
        label={label}
        showLabel={false}
        className={className}
      />
    );
  }

  if (variant === "overlay") {
    return (
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]",
          className
        )}
      >
        <AideLoader size={resolvedSize} label={label} showLabel />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1",
        variant === "page" ? "min-h-[50vh] py-16" : "min-h-[12rem] py-10",
        className
      )}
    >
      <AideLoader size={resolvedSize} label={label} showLabel />
    </div>
  );
}

export default AidePreloader;
