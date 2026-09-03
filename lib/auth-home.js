/** Legacy default — prefer `postAuthPathFromSession` after `/api/auth/me`. */
export function homePathForRole(role) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

const PRODUCT_PREFIXES = [
  "/dashboard",
  "/agents",
  "/chat",
  "/conversations",
  "/analytics",
  "/inbox",
];

export function isProductAppPath(pathname) {
  if (!pathname) return false;
  return PRODUCT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Post-auth destination.
 * New funnel: interest/onboarding → plans → product.
 */
export function postAuthPathFromSession({
  role,
  billing,
  needsOnboarding,
  nextPath,
}) {
  if (role === "ADMIN") return "/admin";

  if (needsOnboarding) {
    return "/billing/onboarding";
  }

  if (!billing?.unlocked) {
    return "/billing/plans";
  }

  if (nextPath && isProductAppPath(nextPath)) {
    return nextPath;
  }

  return "/dashboard";
}

/**
 * Client post-login redirect without `/api/auth/me`.
 * Prefer `/auth/continue` so the server picks onboarding | plans | dashboard once.
 * App `(app)` layout still re-checks billing + onboarding on product routes.
 */
export function resolveFastPostAuthPath(user, nextPath = "", options = {}) {
  const role = user?.role || "USER";
  if (role === "ADMIN") return "/admin";

  if (options.freshSignup) {
    return "/billing/onboarding";
  }

  return continuePathAfterAuth(nextPath);
}

/** Server gate hop after OAuth / email login (avoids wrong /dashboard bounce). */
export function continuePathAfterAuth(nextPath = "") {
  if (nextPath && isProductAppPath(nextPath)) {
    return `/auth/continue?next=${encodeURIComponent(nextPath)}`;
  }
  return "/auth/continue";
}
