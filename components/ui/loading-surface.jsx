"use client";

import { AidePreloader } from "@/components/ui/aide-preloader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton layout with branded preloader on top.
 * Preloader dismisses when the parent stops rendering this surface (data ready).
 */
export function LoadingSurface({
  children,
  label = "Loading…",
  className,
  contentClassName,
}) {
  return (
    <div className={cn("relative isolate min-h-[12rem]", className)} aria-busy="true">
      <div
        className={cn("pointer-events-none select-none", contentClassName)}
        aria-hidden
      >
        {children}
      </div>
      <AidePreloader variant="overlay" label={label} className="z-30" />
    </div>
  );
}

/** Generic app-route placeholder — matches main content chrome while RSC resolves. */
export function AppRouteSkeleton({ className }) {
  return (
    <div className={cn("aide-page", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border bg-muted/40 px-2 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-[4.5rem] shrink-0 rounded-md" />
          ))}
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-40 rounded-xl" />
    </div>
  );
}

export function AppRouteLoading({ label = "Loading…" }) {
  return (
    <LoadingSurface label={label}>
      <AppRouteSkeleton />
    </LoadingSurface>
  );
}

export default LoadingSurface;
