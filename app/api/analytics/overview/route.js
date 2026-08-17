import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import {
  assertAnalyticsQuery,
  getOverviewForUser,
} from "@/lib/services/analytics.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const range = request.nextUrl.searchParams.get("range") || undefined;
    assertAnalyticsQuery({ range });

    const overview = await getOverviewForUser(authResult.user.id, {
      agentId,
      range,
    });
    return NextResponse.json(overview, { status: 200 });
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/overview", error);
  }
}
