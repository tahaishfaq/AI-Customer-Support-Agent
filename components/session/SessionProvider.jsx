"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { AuthHydrate } from "@/components/AuthHydrate";
import { SessionExpiredOverlay } from "@/components/session/SessionExpiredOverlay";

/**
 * NextAuth session context + app session shell (hydrate + expired overlay).
 */
export function SessionProvider({ children }) {
  return (
    // No refetch on every tab focus: each one also broadcast to other same-origin windows
    // (other tabs, the embedded widget iframe), multiplying /api/auth/session calls. Expiry is
    // caught by any API 401 (apiFetch → markSessionExpired); sign-in/out in another tab still
    // arrives via next-auth's broadcast channel.
    <NextAuthSessionProvider refetchOnWindowFocus={false}>
      <AuthHydrate />
      {children}
      <SessionExpiredOverlay />
    </NextAuthSessionProvider>
  );
}
