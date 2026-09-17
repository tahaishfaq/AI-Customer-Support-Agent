import { requireAuth } from "@/lib/require-auth";
import { canManageAgentActions } from "@/lib/actions/action-config";
import { getAgentForUser } from "@/lib/services/agent.service";
import { importOpenApiActionsForAgent } from "@/lib/integrations/openapi/import-openapi";
import { jsonError, jsonOk } from "@/lib/api/error-response";

/**
 * POST /api/agents/[id]/actions/openapi-import
 * Body: { document, baseUrl?, credentialId?, connectionId?, dryRun? }
 * Creates disabled draft AgentActions — never publishes or enables.
 */
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(request, 400, "Validation failed", {
        body: "JSON object required",
      });
    }
    if (body.document === undefined || body.document === null) {
      return jsonError(request, 400, "Validation failed", {
        document: "OpenAPI document (object or JSON string) is required",
      });
    }

    const dryRun = body.dryRun === true;
    const result = await importOpenApiActionsForAgent(id, authResult.user.id, {
      document: body.document,
      baseUrl: body.baseUrl || undefined,
      credentialId: body.credentialId || null,
      connectionId: body.connectionId || null,
      dryRun,
    });

    return jsonOk(request, result, dryRun ? 200 : 201);
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409
    ) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    console.error("POST /api/agents/[id]/actions/openapi-import", error);
    return jsonError(request, 500, "Unable to import OpenAPI actions");
  }
}
