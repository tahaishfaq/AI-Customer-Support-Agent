import { created, fail } from "@/lib/api-response";
import { setAuthCookie } from "@/lib/auth-cookie";
import { registerUser } from "@/lib/services/auth.service";
import { registerSchema, zodErrorDetails } from "@/lib/validations/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Validation failed", 400, zodErrorDetails(parsed.error));
    }

    const result = await registerUser(parsed.data);
    const response = created(result);
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error.status === 409) {
      return fail(error.message, 409);
    }
    console.error("POST /api/auth/register", error);
    return fail("Unable to register", 500);
  }
}
