import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import { getTopicsForUser } from "@/lib/services/analytics.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const topics = await getTopicsForUser(authResult.user.id, { agentId });
    return NextResponse.json(topics, { status: 200 });
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/topics", error, request);
  }
}
