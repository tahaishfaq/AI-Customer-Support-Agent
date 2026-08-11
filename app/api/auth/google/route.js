import { NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-cookie";
import { loginWithGoogle } from "@/lib/services/auth.service";
import { googleSchema, zodErrorDetails } from "@/lib/validations/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = googleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: zodErrorDetails(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const result = await loginWithGoogle(parsed.data.idToken);
    const response = NextResponse.json(result, { status: 200 });
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error.status === 401 || error.status === 500) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/auth/google", error);
    return NextResponse.json(
      { error: { message: "Unable to sign in with Google", details: {} } },
      { status: 500 }
    );
  }
}
