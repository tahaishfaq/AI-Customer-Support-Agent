import { jsonError, jsonOk } from "@/lib/api/error-response";
import { requireAdmin } from "@/lib/require-admin";
import {
  listRecoverableTurnRuns,
  markTurnRunRecoverable,
} from "@/lib/services/turn-run.service";

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) return authResult.error;
  try {
    return jsonOk(request, { turns: await listRecoverableTurnRuns() });
  } catch {
    return jsonError(request, 500, "Unable to load recoverable turns");
  }
}

export async function POST(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) return authResult.error;
  try {
    const body = await request.json().catch(() => ({}));
    if (!body?.id) {
      return jsonError(request, 400, "Validation failed", { id: "id is required" });
    }
    const turn = await markTurnRunRecoverable(String(body.id));
    return jsonOk(request, { turn });
  } catch {
    return jsonError(request, 409, "Turn could not be marked recoverable");
  }
}
