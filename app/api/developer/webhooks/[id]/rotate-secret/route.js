import { developerRoute } from "@/lib/api/developer-route";
import { rotateWebhookSecretForUser } from "@/lib/services/webhook.service";

export async function POST(_request, { params }) {
  const { id } = await params;
  return developerRoute((userId) => rotateWebhookSecretForUser(userId, id), "POST webhook rotate");
}
