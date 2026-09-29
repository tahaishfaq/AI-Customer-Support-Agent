import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import { getResolutionForUser } from "@/lib/services/analytics.service";

const RANGES = new Set(["1d", "7d", "30d", "all"]);

/** Resolution metrics + unanswered questions (owner/member of the agent's workspace only). */
export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const params = request.nextUrl.searchParams;
    const agentId = params.get("agentId") || undefined;
    const rangeParam = params.get("range");
    const range = RANGES.has(rangeParam) ? rangeParam : "30d";
    const data = await getResolutionForUser(authResult.user.id, { agentId, range });
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return handleAnalyticsError("GET /api/analytics/resolution", error, request);
  }
}
