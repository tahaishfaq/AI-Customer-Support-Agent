import { developerRoute, readJson } from "@/lib/api/developer-route";
import { createWebhookForUser, listWebhooksForUser } from "@/lib/services/webhook.service";

export async function GET() {
  return developerRoute((userId) => listWebhooksForUser(userId), "GET webhooks");
}

/** Body: { url, events: string[], includeMessageText? } → { webhook, secret } (secret shown once). */
export async function POST(request) {
  return developerRoute(async (userId) => createWebhookForUser(userId, await readJson(request)), "POST webhooks");
}
