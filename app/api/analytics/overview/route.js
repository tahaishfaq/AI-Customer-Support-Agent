import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getOverviewForUser } from "@/lib/services/analytics.service";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const overview = await getOverviewForUser(authResult.user.id);
    return NextResponse.json(overview, { status: 200 });
  } catch (error) {
    console.error("GET /api/analytics/overview", error);
    return NextResponse.json(
      { error: { message: "Unable to load analytics overview", details: {} } },
      { status: 500 }
    );
  }
}
