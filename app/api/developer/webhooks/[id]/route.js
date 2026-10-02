import { developerRoute, readJson } from "@/lib/api/developer-route";
import { deleteWebhookForUser, updateWebhookForUser } from "@/lib/services/webhook.service";

/** Body: any of { url, events, includeMessageText, enabled }. */
export async function PATCH(request, { params }) {
  const { id } = await params;
  return developerRoute(async (userId) => updateWebhookForUser(userId, id, await readJson(request)), "PATCH webhook");
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  return developerRoute((userId) => deleteWebhookForUser(userId, id), "DELETE webhook");
}
