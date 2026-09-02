import { NextResponse } from "next/server";

/** Brandly-style campaign fixtures for F11 Actions (no e‑commerce orders). */
const CAMPAIGNS = {
  "CAMP-100": {
    id: "CAMP-100",
    name: "Summer Creator Drop",
    status: "ACTIVE",
    niche: "Fashion",
    budgetUsd: 5000,
    matchedCreators: 8,
    pendingRequests: 2,
    brand: "Brandly Demo Co",
  },
  "CAMP-200": {
    id: "CAMP-200",
    name: "Product Launch Week",
    status: "DRAFT",
    niche: "Beauty",
    budgetUsd: 2500,
    matchedCreators: 0,
    pendingRequests: 0,
    brand: "Brandly Demo Co",
  },
  "CAMP-999": {
    id: "CAMP-999",
    name: "Holiday Collab",
    status: "COMPLETED",
    niche: "Lifestyle",
    budgetUsd: 12000,
    matchedCreators: 15,
    pendingRequests: 0,
    brand: "Brandly Demo Co",
  },
};

/**
 * Demo Brandly campaign API for F11 action tests (no auth).
 * Example: GET /api/demo/campaigns/CAMP-100
 */
export async function GET(_request, { params }) {
  const { id } = await params;
  const key = String(id || "").trim();
  const campaign =
    CAMPAIGNS[key] ||
    ({
      id: key || "unknown",
      name: null,
      status: "UNKNOWN",
      niche: null,
      budgetUsd: null,
      matchedCreators: 0,
      pendingRequests: 0,
      brand: null,
    });
  return NextResponse.json(campaign, { status: 200 });
}
