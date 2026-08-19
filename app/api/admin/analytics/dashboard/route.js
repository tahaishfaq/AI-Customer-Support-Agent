import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { handleAnalyticsError } from "@/app/api/analytics/handle-error";
import { assertAnalyticsQuery, getDashboardForPlatform } from "@/lib/services/analytics.service";
import { getAdminWorkspaceDashboard } from "@/lib/services/admin-inspect.service";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    const agentId = request.nextUrl.searchParams.get("agentId") || undefined;
    const range = request.nextUrl.searchParams.get("range") || "7d";
    assertAnalyticsQuery({ range });

    if (!workspaceId) {
      const dashboard = await getDashboardForPlatform({ range });
      return NextResponse.json(dashboard, { status: 200 });
    }

    const dashboard = await getAdminWorkspaceDashboard(workspaceId, {
      range,
      agentId,
    });
    return NextResponse.json(dashboard, { status: 200 });
  } catch (error) {
    return handleAnalyticsError("GET /api/admin/analytics/dashboard", error);
  }
}
