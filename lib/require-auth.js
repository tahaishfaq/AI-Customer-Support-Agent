import { auth } from "@/auth";
import { jsonError } from "@/lib/api/error-response";
import { getCachedPublicUser } from "@/lib/services/user-profile-cache";

/**
 * Resolve the authenticated user from the JWT session (no User table hit).
 * Layouts still re-check DB status / billing / onboarding on document navigations.
 * @param {Request} [request] When provided, error responses include `x-request-id`.
 * @returns {{ user: { id: string, name?: string|null, email?: string|null, role: string } } | { error: NextResponse }}
 */
export async function requireAuth(request = null) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: jsonError(request, 401, "Missing or invalid session"),
    };
  }

  if (session.user.status === "SUSPENDED") {
    return {
      error: jsonError(request, 401, "Account suspended"),
    };
  }

  const role = session.user.role || "USER";

  if (role !== "ADMIN") {
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
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      role,
    },
  };
}

/**
 * Same as requireAuth, but re-reads User (Redis profile cache → DB).
 * Use only when a route needs a live row (e.g. after admin changes mid-session).
 */
export async function requireFreshUser(request = null) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: jsonError(request, 401, "Missing or invalid session"),
    };
  }

  const row = await getCachedPublicUser(session.user.id);

  if (!row?.id) {
    return {
      error: jsonError(request, 401, "Session expired"),
    };
  }

  if (row.status === "SUSPENDED") {
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
