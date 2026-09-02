import { NextResponse } from "next/server";

/**
 * F13-T0 demo ticket create (no persistence).
 * POST /api/demo/tickets  { subject, body }
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const subject = String(body?.subject || "").trim() || "Untitled";
  const text = String(body?.body || "").trim();
  return NextResponse.json(
    {
      ok: true,
      ticketId: `TKT-${Date.now().toString(36).toUpperCase()}`,
      subject,
      body: text,
      status: "open",
    },
    { status: 201 }
  );
}
