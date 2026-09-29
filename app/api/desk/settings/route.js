import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getDeskSettingsForUser, saveDeskSettingsForUser } from "@/lib/services/handoff.service";

function errorResponse(route, error, fallback) {
  if ([400, 403, 404].includes(error.status)) {
    return NextResponse.json(
      { error: { message: error.message, details: error.details || {} } },
      { status: error.status }
    );
  }
  console.error(route, error);
  return NextResponse.json({ error: { message: fallback, details: {} } }, { status: 500 });
}

/** Desk routing + SLA settings, teammates and the caller's desk permissions. Level 2 · M3. */
export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    return NextResponse.json(await getDeskSettingsForUser(authResult.user.id), { status: 200 });
  } catch (error) {
    return errorResponse("GET /api/desk/settings", error, "Unable to load desk settings");
  }
}

/** Owner/Admin only (enforced in the service). */
export async function PUT(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await saveDeskSettingsForUser(authResult.user.id, body), { status: 200 });
  } catch (error) {
    return errorResponse("PUT /api/desk/settings", error, "Unable to save desk settings");
  }
}
