import { jsonError } from "@/lib/api/error-response";
import { safeLogError } from "@/lib/observability/safe-log";
import { resolveRequestId } from "@/lib/observability/request-id";
import {
  ANALYTICS_BUSY_MESSAGE,
  isAnalyticsBusyError,
} from "@/lib/observability/analytics-timeout";

export function handleAnalyticsError(route, error, request = null) {
  const requestId = request ? resolveRequestId(request) : undefined;

  if (error.status === 400 || error.status === 403 || error.status === 404) {
    return jsonError(request, error.status, error.message);
  }

  if (isAnalyticsBusyError(error)) {
    safeLogError(route, {
      requestId,
      route: "analytics",
      status: 503,
      code: error?.code || "ANALYTICS_TIMEOUT",
    });
    return jsonError(request, 503, ANALYTICS_BUSY_MESSAGE);
  }

  safeLogError(route, {
    requestId,
    route: "analytics",
    status: 500,
    code: error?.code || error?.status || undefined,
  });
  return jsonError(request, 500, "Unable to load analytics");
}
