import { jsonError, jsonOk } from "@/lib/api/error-response";
import { requireAdmin } from "@/lib/require-admin";
import { markWriteReconciled } from "@/lib/services/durable-write.service";

export async function POST(request, { params }) {
  const authResult = await requireAdmin(request);
  if (authResult.error) return authResult.error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = String(body?.status || "").toUpperCase();
    if (!["SUCCEEDED", "FAILED"].includes(status)) {
      return jsonError(request, 400, "Validation failed", {
        status: "status must be SUCCEEDED or FAILED",
      });
    }

    const operation = await markWriteReconciled({ id, status });
    return jsonOk(request, { operation });
  } catch (error) {
    if (error.code === "WRITE_NOT_UNKNOWN" || error.code === "WRITE_RECONCILE_INVALID") {
      return jsonError(request, 409, error.message, { code: error.code });
    }
    return jsonError(request, 500, "Unable to reconcile write operation");
  }
}
