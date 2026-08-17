import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Current NextAuth session user (for clients that prefer REST). */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: "Missing or invalid session", details: {} } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
        },
      },
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
