/** Fixed catalog — exactly four slots (B01). */
export const BILLING_PLAN_TYPES = ["FREE", "POPULAR", "TEAMS", "CUSTOM"];

export const BILLING_PLAN_CAP = 4;

export const CUSTOM_REQUEST_LIMIT_PER_DAY = 3;
export const CUSTOM_REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Subscription rows that block a new checkout or gate product access. */
export const OPEN_SUBSCRIPTION_STATUSES = ["PENDING", "ACTIVE", "PAST_DUE"];

/** Statuses that unlock the product shell (PAST_DUE = read-only soft lock in B3). */
export const PRODUCT_UNLOCK_STATUSES = ["ACTIVE", "PAST_DUE"];

/**
 * Seed defaults for the four fixed slots (Botpress Free / Plus / Team / Enterprise).
 * 0 on a limit field = unlimited. Admin edits live on BillingPlan; subscribers
 * read caps via plan join (no per-user snapshot).
 */
export const DEFAULT_BILLING_PLANS = [
  {
    slug: "free",
    name: "Basic",
    description: "Start shipping support agents.",
    planType: "FREE",
    isPopular: false,
    priceMinor: 0,
    currency: "PKR",
    interval: "MONTH",
    safepayPlanId: null,
    maxWorkspaces: 1,
    maxAgentsPerWorkspace: 3,
    maxConversationsPerMonth: 100,
    sortOrder: 1,
    isActive: true,
    isDefault: true,
    featuresJson: [
      "1 workspace",
      "Up to 3 AI agents",
      "100 billable conversations / month",
      "Knowledge FAQs + docs",
      "Embed widget",
      "Conversation history",
    ],
  },
  {
    slug: "popular",
    name: "Popular",
    description: "For growing support volume.",
    planType: "POPULAR",
    isPopular: true,
    priceMinor: 3500,
    currency: "PKR",
    interval: "MONTH",
    safepayPlanId: null,
    maxWorkspaces: 3,
    maxAgentsPerWorkspace: 0,
    maxConversationsPerMonth: 250,
    sortOrder: 2,
    isActive: true,
    isDefault: false,
    featuresJson: [
      "Up to 3 workspaces",
      "Unlimited agents per workspace",
      "250 billable conversations / month",
      "Knowledge FAQs + docs",
      "Embed widget",
      "Conversation history",
      "HTTP tools + confirm flows",
      "Human desk handoff",
      "Analytics & insights",
      "Priority support",
    ],
  },
  {
    slug: "teams",
    name: "Teams",
    description: "Higher volume for multi-brand ops. Coming soon — multi-seat features are not live yet.",
    planType: "TEAMS",
    isPopular: false,
    priceMinor: 7500,
    currency: "PKR",
    interval: "MONTH",
    safepayPlanId: null,
    maxWorkspaces: 10,
    maxAgentsPerWorkspace: 0,
    maxConversationsPerMonth: 1500,
    sortOrder: 3,
    isActive: true,
    isDefault: false,
    featuresJson: [
      "Up to 10 workspaces",
      "Unlimited agents per workspace",
      "1,500 billable conversations / month",
      "Everything in Popular",
      "Priority support",
      "Seats & RBAC (coming soon)",
    ],
  },
  {
    slug: "custom",
    name: "Custom",
    description: "Enterprise volume and bespoke limits.",
    planType: "CUSTOM",
    isPopular: false,
    priceMinor: 0,
    currency: "PKR",
    interval: "MONTH",
    safepayPlanId: null,
    maxWorkspaces: 0,
    maxAgentsPerWorkspace: 0,
    maxConversationsPerMonth: 0,
    sortOrder: 4,
    isActive: true,
    isDefault: false,
    featuresJson: [
      "Custom workspace & agent limits",
      "Custom conversation volume",
      "Dedicated onboarding",
      "SLA options",
      "Contact our team for pricing",
    ],
  },
];
