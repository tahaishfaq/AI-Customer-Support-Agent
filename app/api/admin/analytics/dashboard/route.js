import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import {
  assertAnalyticsQuery,
  getDashboardForPlatform,
} from "@/lib/services/analytics.service";
import { getAdminWorkspaceDashboard } from "@/lib/services/admin-inspect.service";
import { resolveRequestId, requestIdHeaders } from "@/lib/observability/request-id";
import { durationHeaders } from "@/lib/observability/duration";

export async function GET(request) {
  const started = Date.now();
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const range = request.nextUrl.searchParams.get("range") || "7d";
    assertAnalyticsQuery({ range });

    const dashboard = workspaceId
      ? await getAdminWorkspaceDashboard(workspaceId, { range, agentId })
      : await getDashboardForPlatform({ range });

    return NextResponse.json(dashboard, {
      status: 200,
      headers: {
        ...requestIdHeaders(resolveRequestId(request)),
        ...durationHeaders(started),
      },
    });
  } catch (error) {
    return handleAnalyticsError(
      "GET /api/admin/analytics/dashboard",
      error,
      request
    );
  }
}
