import { developerRoute } from "@/lib/api/developer-route";
import { revokeApiKeyForUser } from "@/lib/services/api-key.service";

export async function DELETE(_request, { params }) {
  const { id } = await params;
  return developerRoute((userId) => revokeApiKeyForUser(userId, id), "DELETE api key");
}
