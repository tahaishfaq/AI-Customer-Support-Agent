import { NextResponse } from "next/server";

/**
 * Demo shop / parcel API for F11 + F11-U Sprint D (no auth).
 * Guest-safe: status + carrier + eta only (no email/address).
 *
 * Examples:
 *   GET /api/demo/orders/ORD-100
 *   GET /api/demo/orders/PCL-100   (parcel / courier story)
 */
const ORDERS = {
  "ORD-100": {
    id: "ORD-100",
    status: "Shipped",
    carrier: "DHL",
    eta: "Tuesday",
  },
  "ORD-999": {
    id: "ORD-999",
    status: "Out for delivery",
    carrier: "Local",
    eta: "Today",
  },
  "PCL-100": {
    id: "PCL-100",
    status: "Out for delivery",
    carrier: "Aide Courier",
    eta: "Today 4–6pm",
    servicePoint: "Locker #12 — Main St",
  },
  "PCL-200": {
    id: "PCL-200",
    status: "Delivered",
    carrier: "Aide Courier",
    eta: "Delivered yesterday",
    servicePoint: null,
  },
};

export async function GET(_request, { params }) {
  const { id } = await params;
  const key = String(id || "").trim();
  const order =
    ORDERS[key] ||
    ({
      id: key || "unknown",
      status: "Processing",
      carrier: null,
      eta: null,
    });
  // Guest-safe shape — never include PII in demo responses
  return NextResponse.json(
    {
      id: order.id,
      status: order.status,
      carrier: order.carrier,
      eta: order.eta,
      ...(order.servicePoint ? { servicePoint: order.servicePoint } : {}),
    },
    { status: 200 }
  );
}
