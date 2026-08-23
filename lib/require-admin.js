import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { jsonError } from "@/lib/api/error-response";

/**
 * ADMIN-only. USER sessions get 401 (not 403) so customer APIs stay distinct.
 * @param {Request} [request] When provided, error responses include `x-request-id`.
 */
export async function requireAdmin(request = null) {
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

  if (!row || row.role !== "ADMIN" || row.status === "SUSPENDED") {
    return {
      error: jsonError(request, 401, "Admin access required"),
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
