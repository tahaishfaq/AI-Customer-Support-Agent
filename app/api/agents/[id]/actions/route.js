import { requireAuth } from "@/lib/require-auth";
import {
  createActionForAgent,
  listActionsForAgent,
} from "@/lib/services/action.service";
import {
  createAgentActionSchema,
  zodErrorDetails,
} from "@/lib/validations/actions";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const actions = await listActionsForAgent(id, authResult.user.id);
    return jsonOk(request, { actions }, 200);
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return jsonError(request, error.status, error.message);
    }
    console.error("GET /api/agents/[id]/actions", error);
    return jsonError(request, 500, "Unable to list actions");
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }

    const parsed = createAgentActionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(request, 400, "Validation failed", zodErrorDetails(parsed.error));
    }

    const action = await createActionForAgent(id, authResult.user.id, parsed.data);
    return jsonOk(request, action, 201);
  } catch (error) {
    if (error.status === 403 || error.status === 404 || error.status === 409) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/agents/[id]/actions", error);
    return jsonError(request, 500, "Unable to create action");
  }
}
