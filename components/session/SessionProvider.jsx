"use client";

import { AuthHydrate } from "@/components/AuthHydrate";
import { SessionExpiredOverlay } from "@/components/session/SessionExpiredOverlay";

/**
 * Top-level session shell (composition wrapper — not React Context).
 * Everything under Providers lives inside this layer.
 */
export function SessionProvider({ children }) {
  return (
    <>
      <AuthHydrate />
      {children}
      <SessionExpiredOverlay />
    </>
  );
}
