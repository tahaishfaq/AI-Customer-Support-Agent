import { fail, ok } from "@/lib/api-response";
import { getUserFromRequest, toPublicUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return fail("Missing or invalid token", 401);
    }

    return ok({ user: toPublicUser(user) });
  } catch (error) {
    console.error("GET /api/auth/me", error);
    return fail("Unable to load user", 500);
  }
}
