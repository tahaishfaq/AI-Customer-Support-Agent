import { developerRoute } from "@/lib/api/developer-route";
import { listDeliveriesForUser } from "@/lib/services/webhook.service";

export async function GET(_request, { params }) {
  const { id } = await params;
  return developerRoute((userId) => listDeliveriesForUser(userId, id), "GET webhook deliveries");
}
