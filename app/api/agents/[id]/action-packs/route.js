import { requireAuth } from "@/lib/require-auth";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { createActionPack } from "@/lib/integrations/action-pack";
import { getAgentForUser } from "@/lib/services/agent.service";
import { jsonError, jsonOk } from "@/lib/api/error-response";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const agent = await getAgentForUser(id, authResult.user.id);
    if (!canManageAgentActions({ userId: authResult.user.id, agent })) {
      return jsonError(request, 403, "Not allowed to manage actions for this agent");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.packId) {
      return jsonError(request, 400, "Validation failed", {
        packId:
          "packId is required (named packs or universal:B01…B50)",
      });
    }

    const result = await createActionPack({
      agentId: id,
      workspaceId: agent.workspaceId,
      packId: String(body.packId),
      credentialId: body.credentialId || null,
    });
    return jsonOk(request, result, 201);
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404
    ) {
      return jsonError(request, error.status, error.message, error.details || {});
    }
    console.error("POST /api/agents/[id]/action-packs", error);
    return jsonError(request, 500, "Unable to create action pack");
  }
}
