import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

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

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!row || row.status === "SUSPENDED") {
    return {
      error: NextResponse.json(
        { error: { message: "Account suspended", details: {} } },
        { status: 401 }
      ),
    };
  }

  if (row.role !== "ADMIN") {
    const { getPlatformSettings } = await import(
      "@/lib/services/platform-settings.service"
    );
    const settings = await getPlatformSettings();
    if (settings.maintenanceMode) {
      return {
        error: NextResponse.json(
          { error: { message: "The product is under maintenance", details: {} } },
          { status: 503 }
        ),
      };
    }
  }

  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role || "USER",
    },
  };
}
