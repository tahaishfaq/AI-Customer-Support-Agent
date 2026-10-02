import { v1Route } from "@/lib/api/v1-route";
import { apiListMessages } from "@/lib/services/public-api.service";

/** GET /api/v1/conversations/:id/messages?limit&cursor — oldest first; internal notes excluded. */
export async function GET(request, { params }) {
  const { id } = await params;
  return v1Route(request, (workspaceId, query) => apiListMessages(workspaceId, id, query), "messages");
}
