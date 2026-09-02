import { signalHumanTyping } from "@/lib/services/handoff.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";
import { auth } from "@/auth";

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return jsonError(request, 401, "Unauthorized");
    }

    const { id: conversationId } = await params;
    const result = await signalHumanTyping({ conversationId, userId });
    return jsonOk(request, result, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    safeLogError("POST /api/conversations/[id]/typing", {
      requestId,
      route: "desk-typing",
      status: 500,
    });
    return jsonError(request, 500, "Unable to signal typing");
  }
}
