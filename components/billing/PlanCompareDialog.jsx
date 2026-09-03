"use client";

import { Check, Minus, X } from "lucide-react";
import {
  formatPlanPriceLabel,
  getPlanLimitRows,
  isBasicPlan,
  planBestFor,
} from "@/lib/billing/plan-labels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Botpress-style capability ladder — matched from admin feature bullets + plan type. */
const FEATURE_KEYS = [
  { key: "knowledge", label: "Knowledge FAQs + docs", match: /faq|knowledge|docs/i },
  { key: "embed", label: "Embed / webchat widget", match: /embed|webchat|widget/i },
  { key: "history", label: "Conversation history", match: /history/i },
  { key: "tools", label: "HTTP tools + confirms", match: /http|tool|confirm/i },
  { key: "desk", label: "Human desk handoff", match: /desk|handoff/i },
  { key: "analytics", label: "Analytics & insights", match: /analytics|insight/i },
  { key: "priority", label: "Priority support", match: /priority/i },
  { key: "seats", label: "Seats & RBAC", match: /seat|rbac|role/i },
  { key: "sla", label: "SLA / dedicated onboarding", match: /sla|onboarding|dedicated/i },
];

const TEAMS_INHERITS = new Set([
  "knowledge",
  "embed",
  "history",
  "tools",
  "desk",
  "analytics",
  "priority",
]);

function featureSupported(plan, feature) {
  if (plan?.planType === "CUSTOM") return "custom";
  if (feature.key === "seats") {
    if (/seat|rbac|role/i.test((plan?.features || []).join(" "))) {
      return /coming soon/i.test((plan?.features || []).join(" "))
        ? "soon"
        : true;
    }
    return false;
  }
  const features = plan?.features || [];
  if (features.some((f) => feature.match.test(String(f)))) return true;
  if (
    plan?.planType === "TEAMS" &&
    TEAMS_INHERITS.has(feature.key) &&
    /everything in popular/i.test(features.join(" "))
  ) {
    return true;
  }
  return false;
}

function CellMark({ value }) {
  if (value === "custom") {
    return (
      <span className="text-[12px] font-medium text-muted-foreground">Custom</span>
    );
  }
  if (value === "soon") {
    return (
      <span className="text-[11px] font-medium text-muted-foreground">Soon</span>
    );
  }
  if (value === true) {
    return <Check className="mx-auto size-4 text-primary" aria-label="Included" />;
  }
  return <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Not included" />;
}

export function PlanCompareDialog({
  open,
  onOpenChange,
  plans = [],
  billingInterval = "month",
}) {
  const ordered = [...plans].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,52rem)] w-[min(96vw,72rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-[72rem]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <DialogTitle className="landing-display text-xl text-foreground sm:text-2xl">
            Compare plans
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Limits and capabilities come from the live admin catalog. Prices shown as{" "}
            {billingInterval === "year" ? "yearly (10 months billed)" : "monthly"}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-popover">
              <tr className="border-b border-border">
                <th className="w-[12rem] px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:px-5">
                  Access
                </th>
                {ordered.map((plan) => (
                  <th
                    key={plan.id}
                    className={cn(
                      "min-w-[8.5rem] px-3 py-3 sm:px-4",
                      plan.isPopular && "bg-primary/5"
                    )}
                  >
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      {planBestFor(plan)}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{plan.name}</p>
                    <p className="mt-1 text-[13px] tabular-nums text-foreground">
                      {formatPlanPriceLabel(plan, billingInterval)}
                    </p>
                    {plan.comingSoon ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">Coming soon</p>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border bg-muted/30">
                <td
                  colSpan={ordered.length + 1}
                  className="px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:px-5"
                >
                  Usage limits
                </td>
              </tr>
              {(ordered[0] ? getPlanLimitRows(ordered[0]) : []).map((row) => (
                <tr key={row.key} className="border-b border-border">
                  <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.label}</td>
                  {ordered.map((plan) => {
                    const match = getPlanLimitRows(plan).find((r) => r.key === row.key);
                    return (
                      <td
                        key={plan.id}
                        className={cn(
                          "px-3 py-3 text-center font-medium tabular-nums text-foreground sm:px-4",
                          plan.isPopular && "bg-primary/5"
                        )}
                      >
                        {match?.value ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="border-b border-border bg-muted/30">
                <td
                  colSpan={ordered.length + 1}
                  className="px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:px-5"
                >
                  Capabilities
                </td>
              </tr>
              {FEATURE_KEYS.map((feature) => (
                <tr key={feature.key} className="border-b border-border">
                  <td className="px-4 py-3 text-muted-foreground sm:px-5">
                    {feature.label}
                  </td>
                  {ordered.map((plan) => (
                    <td
                      key={plan.id}
                      className={cn(
                        "px-3 py-3 text-center sm:px-4",
                        plan.isPopular && "bg-primary/5"
                      )}
                    >
                      <CellMark value={featureSupported(plan, feature)} />
                    </td>
                  ))}
                </tr>
              ))}

              <tr className="border-b border-border">
                <td className="px-4 py-3 text-muted-foreground sm:px-5">Card required</td>
                {ordered.map((plan) => (
                  <td
                    key={plan.id}
                    className={cn(
                      "px-3 py-3 text-center sm:px-4",
                      plan.isPopular && "bg-primary/5"
                    )}
                  >
                    {isBasicPlan(plan) || plan.planType === "CUSTOM" ? (
                      <X className="mx-auto size-4 text-muted-foreground/50" aria-label="No" />
                    ) : (
                      <Check className="mx-auto size-4 text-primary" aria-label="Yes" />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
