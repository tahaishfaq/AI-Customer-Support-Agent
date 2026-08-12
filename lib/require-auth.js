import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Resolve the authenticated user from NextAuth session.
 * @returns {{ user: { id: string, name?: string|null, email?: string|null } } | { error: NextResponse }}
 */
export async function requireAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { error: { message: "Missing or invalid session", details: {} } },
        { status: 401 }
      ),
    };
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  };
}
