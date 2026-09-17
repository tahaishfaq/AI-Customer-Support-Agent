import { jsonError, jsonOk } from "@/lib/api/error-response";
import { requireAdmin } from "@/lib/require-admin";
import { listUnknownWrites } from "@/lib/services/durable-write.service";

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) return authResult.error;

  try {
    const limit = request.nextUrl.searchParams.get("limit");
    return jsonOk(request, {
      operations: await listUnknownWrites({ limit }),
    });
  } catch {
    return jsonError(request, 500, "Unable to load unknown write operations");
  }
}
