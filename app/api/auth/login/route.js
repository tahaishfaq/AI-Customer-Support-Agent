import { NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth-cookie";
import { loginUser } from "@/lib/services/auth.service";
import { loginSchema, zodErrorDetails } from "@/lib/validations/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

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

    const result = await loginUser(parsed.data);
    const response = NextResponse.json(result, { status: 200 });
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error.status === 401) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 401 }
      );
    }
    console.error("POST /api/auth/login", error);
    return NextResponse.json(
      { error: { message: "Unable to login", details: {} } },
      { status: 500 }
    );
  }
}
