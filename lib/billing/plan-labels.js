/** Display name for the FREE plan slot (planType stays FREE in DB). */
export const BASIC_PLAN_NAME = "Basic";

/** Paid slots not yet available for checkout (multi-seat / Teams features pending). */
export const COMING_SOON_PLAN_TYPES = new Set(["TEAMS"]);

/**
 * Yearly billing display (checkout remains MONTH until SafePay YEAR plans exist).
 * Pay for 10 months, get 12 → ~16.7% save.
 * Examples at default seed prices:
 *   Popular 3,500/mo → 35,000/yr (≈ 2,917/mo billed yearly)
 *   Teams   7,500/mo → 75,000/yr (≈ 6,250/mo billed yearly)
 */
export const YEARLY_BILLABLE_MONTHS = 10;

export function isPlanComingSoon(plan) {
  return COMING_SOON_PLAN_TYPES.has(plan?.planType);
}

export function isBasicPlan(plan) {
  return plan?.planType === "FREE";
}

export function planBestFor(plan) {
  switch (plan?.planType) {
    case "FREE":
      return "Solo builders";
    case "POPULAR":
      return "Most teams";
    case "TEAMS":
      return "Multi-seat ops";
    case "CUSTOM":
      return "Enterprise";
    default:
      return "Teams";
  }
}

export function yearlyPriceMinor(plan) {
  if (!plan?.priceMinor) return 0;
  return plan.priceMinor * YEARLY_BILLABLE_MONTHS;
}

export function yearlyEquivalentMonthlyMinor(plan) {
  if (!plan?.priceMinor) return 0;
  return Math.round(yearlyPriceMinor(plan) / 12);
}

export function formatPkr(amount) {
  return `Rs ${Number(amount || 0).toLocaleString("en-PK")}`;
}

/**
 * @param {object} plan
 * @param {"month"|"year"} [billingInterval]
 */
export function formatPlanPriceLabel(plan, billingInterval = "month") {
  if (!plan) return "—";
  if (plan.planType === "CUSTOM") return "Contact us";
  if (!plan.priceMinor) return "Rs 0";
  if (billingInterval === "year") {
    return formatPkr(yearlyPriceMinor(plan));
  }
  return formatPkr(plan.priceMinor);
}

/**
 * @param {object} plan
 * @param {"month"|"year"} [billingInterval]
 */
export function formatPlanPriceNote(plan, billingInterval = "month") {
  if (!plan) return "";
  if (plan.planType === "CUSTOM") return "Volume pricing";
  if (isBasicPlan(plan)) return "No card required";
  if (billingInterval === "year") {
    return `PKR / year · ~${formatPkr(yearlyEquivalentMonthlyMinor(plan))} / mo`;
  }
  return "PKR / month";
}

export function formatLimitValue(value, { unlimitedLabel = "Custom" } = {}) {
  if (value == null || value <= 0) return unlimitedLabel;
  return value.toLocaleString("en-PK");
}

/** Structured limits for cards + compare table. */
export function getPlanLimitRows(plan) {
  if (!plan) return [];
  const isCustom = plan.planType === "CUSTOM";
  const unlimitedLabel = isCustom ? "Custom" : "Unlimited";
  return [
    {
      key: "workspaces",
      label: "Workspaces",
      value: formatLimitValue(plan.maxWorkspaces, { unlimitedLabel }),
      raw: plan.maxWorkspaces,
    },
    {
      key: "agents",
      label: "Agents / workspace",
      value: formatLimitValue(plan.maxAgentsPerWorkspace, { unlimitedLabel }),
      raw: plan.maxAgentsPerWorkspace,
    },
    {
      key: "conversations",
      label: "Conversations / month",
      value: formatLimitValue(plan.maxConversationsPerMonth, { unlimitedLabel }),
      raw: plan.maxConversationsPerMonth,
    },
  ];
}
