import { NextResponse } from "next/server";

const ITEMS = {
  "ITEM-1": {
    id: "ITEM-1",
    name: "Starter plan",
    category: "plans",
    price: 29,
    summary: "Good for small teams getting started.",
  },
  "ITEM-2": {
    id: "ITEM-2",
    name: "Pro plan",
    category: "plans",
    price: 79,
    summary: "Includes advanced analytics and priority support.",
  },
  "ITEM-3": {
    id: "ITEM-3",
    name: "Onboarding kit",
    category: "addons",
    price: 49,
    summary: "Guided setup for your first agent.",
  },
};

/**
 * F13-T0 demo catalog detail.
 * GET /api/demo/items/ITEM-1
 */
export async function GET(_request, { params }) {
  const { id } = await params;
  const key = String(id || "").trim();
  const item =
    ITEMS[key] ||
    ({
      id: key || "unknown",
      name: "Unknown item",
      category: null,
      price: null,
      summary: "No fixture for this id — use ITEM-1, ITEM-2, or ITEM-3.",
    });
  return NextResponse.json(item, { status: 200 });
}
