import { v1Route } from "@/lib/api/v1-route";
import { apiListConversations } from "@/lib/services/public-api.service";

/** GET /api/v1/conversations?agentId&status&since&limit&cursor — newest first, cursor-paged. */
export async function GET(request) {
  return v1Route(request, (workspaceId, query) => apiListConversations(workspaceId, query), "conversations");
}
