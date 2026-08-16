import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import { getSentimentForUser } from "@/lib/services/analytics.service";

export async function GET(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const sentiment = await getSentimentForUser(authResult.user.id, {
      agentId,
    });
    return NextResponse.json(sentiment, { status: 200 });
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/sentiment", error);
  }
}
