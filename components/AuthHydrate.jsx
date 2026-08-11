"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

/** Loads session from cookie via GET /api/auth/me once on app start. */
export function AuthHydrate() {
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return null;
}
