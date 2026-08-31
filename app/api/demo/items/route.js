import { NextResponse } from "next/server";

const ITEMS = [
  {
    id: "ITEM-1",
    name: "Starter plan",
    category: "plans",
    price: 29,
  },
  {
    id: "ITEM-2",
    name: "Pro plan",
    category: "plans",
    price: 79,
  },
  {
    id: "ITEM-3",
    name: "Onboarding kit",
    category: "addons",
    price: 49,
  },
];

/**
 * F13-T0 demo catalog list.
 * GET /api/demo/items
 */
export async function GET() {
  return NextResponse.json({ items: ITEMS }, { status: 200 });
}
