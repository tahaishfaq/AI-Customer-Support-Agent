"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/api-client";

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  sessionExpired: false,

  markSessionExpired: () =>
    set({ user: null, sessionExpired: true, loading: false }),

  clearSessionExpired: () => set({ sessionExpired: false }),

  hydrate: async () => {
    try {
      const data = await apiFetch("/api/auth/me");
      set({ user: data.user, loading: false, sessionExpired: false });
      return data.user;
    } catch (error) {
      // Cookie may still exist after JWT expiry; Proxy only checks presence.
      // On app pages, treat /me 401 as expired session UI.
      const onAppPage =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/dashboard") ||
          window.location.pathname.startsWith("/agents") ||
          window.location.pathname.startsWith("/chat") ||
          window.location.pathname.startsWith("/analytics"));

      if (error?.status === 401 && onAppPage) {
        set({ user: null, sessionExpired: true, loading: false });
      } else if (!get().sessionExpired) {
        set({ user: null, loading: false });
      }
      return null;
    }
  },

  login: async (email, password) => {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    set({ user: data.user, loading: false, sessionExpired: false });
    return data.user;
  },

  register: async (payload) => {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    set({ user: data.user, loading: false, sessionExpired: false });
    return data.user;
  },

  loginWithGoogle: async (idToken) => {
    const data = await apiFetch("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    set({ user: data.user, loading: false, sessionExpired: false });
    return data.user;
  },

  logout: async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // clear local state anyway
    }
    set({ user: null, sessionExpired: false });
  },

  refreshUser: async () => get().hydrate(),
}));
