import { cn } from "@/lib/utils";

/** Critical surface error — role=alert + optional Try again (F04-D). */
export function InlineAlert({
  children,
  onRetry,
  retryLabel = "Try again",
  className,
}) {
  if (!children) return null;
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3",
        className
      )}
      role="alert"
    >
      <p className="text-sm text-[var(--color-danger)]">{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-[var(--color-primary)] underline underline-offset-2"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
