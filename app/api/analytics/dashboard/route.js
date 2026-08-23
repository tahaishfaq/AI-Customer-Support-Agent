import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import {
  assertAnalyticsQuery,
  getDashboardForUser,
} from "@/lib/services/analytics.service";
import { resolveRequestId, requestIdHeaders } from "@/lib/observability/request-id";
import { durationHeaders } from "@/lib/observability/duration";

export async function GET(request) {
  const started = Date.now();
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const range = request.nextUrl.searchParams.get("range") || "7d";
    assertAnalyticsQuery({ range });

    const dashboard = await getDashboardForUser(authResult.user.id, {
      agentId,
      range,
    });
    return NextResponse.json(dashboard, {
      status: 200,
      headers: {
        ...requestIdHeaders(resolveRequestId(request)),
        ...durationHeaders(started),
      },
    });
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/dashboard", error, request);
  }
}
