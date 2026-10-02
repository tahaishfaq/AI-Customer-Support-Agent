import { developerRoute, readJson } from "@/lib/api/developer-route";
import { createApiKeyForUser, listApiKeysForUser } from "@/lib/services/api-key.service";

export async function GET() {
  return developerRoute((userId) => listApiKeysForUser(userId), "GET api keys");
}

/** Body: { name } → { key, secret } (the full key is shown once). */
export async function POST(request) {
  return developerRoute(async (userId) => createApiKeyForUser(userId, await readJson(request)), "POST api keys");
}
