"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { AuthHydrate } from "@/components/AuthHydrate";
import { SessionExpiredOverlay } from "@/components/session/SessionExpiredOverlay";

/**
 * NextAuth session context + app session shell (hydrate + expired overlay).
 */
export function SessionProvider({ children }) {
  return (
    <NextAuthSessionProvider>
      <AuthHydrate />
      {children}
      <SessionExpiredOverlay />
    </NextAuthSessionProvider>
  );
}
