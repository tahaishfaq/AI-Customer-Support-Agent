import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { clearAuthCookie } from "@/lib/auth-cookie";

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: { message: "Missing or invalid token", details: {} } },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("POST /api/auth/logout", error);
    return NextResponse.json(
      { error: { message: "Unable to logout", details: {} } },
      { status: 500 }
    );
  }
}
