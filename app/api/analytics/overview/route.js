import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getOverviewForUser } from "@/lib/services/analytics.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const overview = await getOverviewForUser(authResult.user.id, { agentId });
    return NextResponse.json(overview, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("GET /api/analytics/overview", error);
    return NextResponse.json(
      { error: { message: "Unable to load analytics overview", details: {} } },
      { status: 500 }
    );
  }
}
