import { cn } from "@/lib/utils";

/**
 * Empty surface for lists / desks (D0).
 * Prefer composing shadcn Empty when available; this keeps the existing API
 * used across Knowledge / Admin while using semantic tokens only.
 */
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
        "flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground [&_svg:not([class*='size-'])]:size-5">
          <Icon />
        </span>
      ) : null}
      <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5 flex justify-center">{action}</div>
      ) : null}
    </div>
  );
}
