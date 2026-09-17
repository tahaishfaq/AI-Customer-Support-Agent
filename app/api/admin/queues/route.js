import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getAdminQueueCounts } from "@/lib/services/admin-queues.service";
import { resolveRequestId, requestIdHeaders } from "@/lib/observability/request-id";
import { durationHeaders } from "@/lib/observability/duration";
import { jsonError } from "@/lib/api/error-response";
import { safeLogError } from "@/lib/observability/safe-log";

/** Admin-only — queue depth counts. No job payloads. */
export async function GET(request) {
  const started = Date.now();
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const queues = await getAdminQueueCounts();
    return NextResponse.json(
      { queues },
      {
        status: 200,
        headers: {
          ...requestIdHeaders(resolveRequestId(request)),
          ...durationHeaders(started),
        },
      }
    );
  } catch (error) {
    safeLogError("GET /api/admin/queues", {
      route: "admin-queues",
      status: 500,
    });
    return jsonError(request, 500, "Unable to load queue counts");
  }
}
