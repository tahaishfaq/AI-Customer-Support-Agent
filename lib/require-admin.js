import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

/**
 * ADMIN-only. USER sessions get 401 (not 403) so customer APIs stay distinct.
 */
export async function requireAdmin() {
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

  if (!row || row.role !== "ADMIN" || row.status === "SUSPENDED") {
    return {
      error: NextResponse.json(
        { error: { message: "Admin access required", details: {} } },
        { status: 401 }
      ),
    };
  }

  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
    },
  };
}
