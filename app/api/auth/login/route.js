import { fail, ok } from "@/lib/api-response";
import { setAuthCookie } from "@/lib/auth-cookie";
import { loginUser } from "@/lib/services/auth.service";
import { loginSchema, zodErrorDetails } from "@/lib/validations/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Validation failed", 400, zodErrorDetails(parsed.error));
    }

    const result = await loginUser(parsed.data);
    const response = ok(result);
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error.status === 401) {
      return fail(error.message, 401);
    }
    console.error("POST /api/auth/login", error);
    return fail("Unable to login", 500);
  }
}
