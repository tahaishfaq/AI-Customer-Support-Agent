import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import {
  assertAnalyticsQuery,
  getDashboardForUser,
} from "@/lib/services/analytics.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const range = request.nextUrl.searchParams.get("range") || "7d";
    assertAnalyticsQuery({ range });

    const dashboard = await getDashboardForUser(authResult.user.id, {
      agentId,
      range,
    });
    return NextResponse.json(dashboard, { status: 200 });
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/dashboard", error);
  }
}
