import { fail, ok } from "@/lib/api-response";
import { getUserFromRequest } from "@/lib/auth";
import { clearAuthCookie } from "@/lib/auth-cookie";

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return fail("Missing or invalid token", 401);
    }

    const response = ok({ message: "Logged out successfully" });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("POST /api/auth/logout", error);
    return fail("Unable to logout", 500);
  }
}
