import { cn } from "@/lib/utils";

/** One-job empty surface — title + single primary CTA (F04-C). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          <Icon className="size-5" />
        </span>
      ) : null}
      <h2 className="mt-4 text-sm font-semibold text-[var(--color-text)]">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--color-text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
