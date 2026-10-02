import { developerRoute } from "@/lib/api/developer-route";
import { sendTestWebhookForUser } from "@/lib/services/webhook.service";

export async function POST(_request, { params }) {
  const { id } = await params;
  return developerRoute((userId) => sendTestWebhookForUser(userId, id), "POST webhook test");
}
