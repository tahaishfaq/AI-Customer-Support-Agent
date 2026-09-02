import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import {
  assertAnalyticsQuery,
  getTrendsForUser,
} from "@/lib/services/analytics.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const period = request.nextUrl.searchParams.get("period") || "day";
    const days = request.nextUrl.searchParams.get("days") || "7";
    assertAnalyticsQuery({ period, days });

    const trends = await getTrendsForUser(authResult.user.id, {
      agentId,
      period,
      days,
    });
    return NextResponse.json(trends, { status: 200 });
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/trends", error, request);
  }
}
