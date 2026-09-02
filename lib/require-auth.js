import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { jsonError } from "@/lib/api/error-response";

/**
 * Resolve the authenticated user from NextAuth session.
 * @param {Request} [request] When provided, error responses include `x-request-id`.
 * @returns {{ user: { id: string, name?: string|null, email?: string|null } } | { error: NextResponse }}
 */
export async function requireAuth(request = null) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: jsonError(request, 401, "Missing or invalid session"),
    };
  }

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!row || row.status === "SUSPENDED") {
    return {
      error: jsonError(request, 401, "Account suspended"),
    };
  }

  if (row.role !== "ADMIN") {
    const { getPlatformSettings } = await import(
      "@/lib/services/platform-settings.service"
    );
    const settings = await getPlatformSettings();
    if (settings.maintenanceMode) {
      return {
        error: jsonError(
          request,
          503,
          "The product is under maintenance"
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
