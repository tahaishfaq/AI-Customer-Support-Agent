import { NextResponse } from "next/server";

const ITEMS = [
  {
    id: "ITEM-1",
    name: "Brandly Starter",
    category: "plans",
    price: 29,
    includes: ["1 active campaign", "AI matching", "Basic analytics"],
  },
  {
    id: "ITEM-2",
    name: "Brandly Pro",
    category: "plans",
    price: 79,
    includes: [
      "Unlimited campaigns",
      "Priority AI matching",
      "Escrow + Stripe payouts",
      "Team seats",
    ],
  },
  {
    id: "ITEM-3",
    name: "Creator onboarding kit",
    category: "addons",
    price: 49,
    includes: ["Profile review", "Social OAuth setup guide"],
  },
];

/**
 * Brandly demo catalog list.
 * GET /api/demo/items
 */
export async function GET() {
  return NextResponse.json({ items: ITEMS }, { status: 200 });
}
