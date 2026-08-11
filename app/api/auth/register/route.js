import { NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-cookie";
import { registerUser } from "@/lib/services/auth.service";
import { registerSchema, zodErrorDetails } from "@/lib/validations/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

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

    const result = await registerUser(parsed.data);
    const response = NextResponse.json(result, { status: 201 });
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error.status === 409) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 409 }
      );
    }
    console.error("POST /api/auth/register", error);
    return NextResponse.json(
      { error: { message: "Unable to register", details: {} } },
      { status: 500 }
    );
  }
}
