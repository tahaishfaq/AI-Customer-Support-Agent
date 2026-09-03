import { apiFetch } from "@/lib/api-client";
import {
  postAuthPathFromSession,
  resolveFastPostAuthPath,
} from "@/lib/auth-home";

export { resolveFastPostAuthPath };

export async function getAuthMe() {
  return apiFetch("/api/auth/me");
}

/** Full billing/onboarding snapshot — use when destination depends on paid state. */
export async function resolveClientPostAuthPath(nextPath = "") {
  const data = await getAuthMe();
  return (
    data.destination ||
    postAuthPathFromSession({
      role: data.user?.role,
      billing: data.billing,
      needsOnboarding: data.needsOnboarding,
      nextPath,
    })
  );
}
