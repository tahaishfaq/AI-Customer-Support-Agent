"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

/** Loads NextAuth session into the auth store once on app start. */
export function AuthHydrate() {
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return null;
}
