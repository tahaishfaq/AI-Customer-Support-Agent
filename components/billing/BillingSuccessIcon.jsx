import { cn } from "@/lib/utils";

export function BillingSuccessIcon({ confirmed = false, className }) {
  return (
    <div
      className={cn(
        "relative flex size-[4.5rem] items-center justify-center",
        className
      )}
      aria-hidden
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full border-2 animate-billing-success-ring",
          confirmed
            ? "border-[color-mix(in_oklch,var(--color-success)_55%,transparent)] bg-[color-mix(in_oklch,var(--color-success)_12%,transparent)]"
            : "border-primary/35 bg-primary/8 animate-billing-success-pulse"
        )}
      />
      <svg
        viewBox="0 0 52 52"
        className="relative size-11 animate-billing-success-pop"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="26"
          cy="26"
          r="24"
          className={cn(
            "stroke-[2.5]",
            confirmed ? "stroke-[var(--color-success)]/30" : "stroke-primary/25"
          )}
        />
        <path
          d="M15 27.5 22.5 35 37 19.5"
          className={cn(
            "billing-success-check-path stroke-[3] stroke-linecap-round stroke-linejoin-round",
            confirmed ? "stroke-[var(--color-success)]" : "stroke-primary"
          )}
          pathLength="1"
        />
      </svg>
    </div>
  );
}
