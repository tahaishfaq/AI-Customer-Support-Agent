import { v1Route } from "@/lib/api/v1-route";
import { apiListAgents } from "@/lib/services/public-api.service";

/** GET /api/v1/agents — agents in the API key's workspace. */
export async function GET(request) {
  return v1Route(request, (workspaceId) => apiListAgents(workspaceId), "agents");
}
