import { NextResponse } from "next/server";
import { getUserFromRequest, toPublicUser } from "@/lib/auth";

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: { message: "Missing or invalid token", details: {} } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { user: toPublicUser(user) },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/auth/me", error);
    return NextResponse.json(
      { error: { message: "Unable to load user", details: {} } },
      { status: 500 }
    );
  }
}
