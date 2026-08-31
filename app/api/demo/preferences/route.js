import { NextResponse } from "next/server";

/**
 * F13-T0 demo preference update (no persistence).
 * POST /api/demo/preferences  { key, value }
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const key = String(body?.key || "").trim() || "unknown";
  const value = String(body?.value || "").trim();
  return NextResponse.json(
    {
      ok: true,
      key,
      value,
      updatedAt: new Date().toISOString(),
    },
    { status: 200 }
  );
}
