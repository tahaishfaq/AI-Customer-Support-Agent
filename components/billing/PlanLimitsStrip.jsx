import { getPlanLimitRows } from "@/lib/billing/plan-labels";
import { cn } from "@/lib/utils";

export function PlanLimitsStrip({ plan, className, compact = false }) {
  const rows = getPlanLimitRows(plan);
  if (!rows.length) return null;

  return (
    <dl
      className={cn(
        "grid grid-cols-3 gap-2 border-t border-border pt-4",
        className
      )}
    >
      {rows.map((row) => (
        <div key={row.key} className="min-w-0 text-center">
          <dt
            className={cn(
              "truncate text-muted-foreground uppercase",
              compact ? "text-[9px] tracking-[0.1em]" : "text-[10px] tracking-[0.12em]"
            )}
          >
            {row.key === "workspaces"
              ? "Workspaces"
              : row.key === "agents"
                ? "Agents"
                : "Convos"}
          </dt>
          <dd
            className={cn(
              "mt-1 font-semibold tabular-nums text-foreground",
              compact ? "text-sm" : "text-[15px]"
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
