import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getPlatformOverview } from "@/lib/services/admin-overview.service";
import { resolveRequestId, requestIdHeaders } from "@/lib/observability/request-id";
import { durationHeaders } from "@/lib/observability/duration";
import { jsonError } from "@/lib/api/error-response";
import { safeLogError } from "@/lib/observability/safe-log";

export async function GET(request) {
  const started = Date.now();
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const overview = await getPlatformOverview();
    return NextResponse.json(
      { overview },
      {
        status: 200,
        headers: {
          ...requestIdHeaders(resolveRequestId(request)),
          ...durationHeaders(started),
        },
      }
    );
  } catch (error) {
    safeLogError("GET /api/admin/overview", {
      route: "admin-overview",
      status: 500,
    });
    return jsonError(request, 500, "Unable to load admin overview");
  }
}
