import { fail, ok } from "@/lib/api-response";
import { setAuthCookie } from "@/lib/auth-cookie";
import { loginWithGoogle } from "@/lib/services/auth.service";
import { googleSchema, zodErrorDetails } from "@/lib/validations/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = googleSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Validation failed", 400, zodErrorDetails(parsed.error));
    }

    const result = await loginWithGoogle(parsed.data.idToken);
    const response = ok(result);
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error.status === 401 || error.status === 500) {
      return fail(error.message, error.status);
    }
    console.error("POST /api/auth/google", error);
    return fail("Unable to sign in with Google", 500);
  }
}
