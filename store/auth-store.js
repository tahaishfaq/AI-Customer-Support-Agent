"use client";

import { create } from "zustand";
import { getSession, signIn, signOut } from "next-auth/react";
import { apiFetch } from "@/lib/api-client";

function toStoreUser(sessionUser) {
  if (!sessionUser?.id && !sessionUser?.email) return null;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
  };
}

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  sessionExpired: false,

  markSessionExpired: () =>
    set({ user: null, sessionExpired: true, loading: false }),

  clearSessionExpired: () => set({ sessionExpired: false }),

  hydrate: async () => {
    try {
      const session = await getSession();
      const user = toStoreUser(session?.user);
      set({ user, loading: false, sessionExpired: false });
      return user;
    } catch {
      if (!get().sessionExpired) {
        set({ user: null, loading: false });
      }
      return null;
    }
  },

  login: async (email, password) => {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      const err = new Error("Invalid email or password");
      err.status = 401;
      throw err;
    }

    const user = await get().hydrate();
    if (!user) {
      throw new Error("Unable to login");
    }
    return user;
  },

  register: async (payload) => {
    await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const result = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });

    if (result?.error) {
      throw new Error("Account created but login failed. Please log in.");
    }

    const user = await get().hydrate();
    if (!user) {
      throw new Error("Account created but session failed. Please log in.");
    }
    return user;
  },

  loginWithGoogle: async (idToken) => {
    const result = await signIn("google-id-token", {
      idToken,
      redirect: false,
    });

    if (result?.error) {
      const err = new Error("Google sign-in failed");
      err.status = 401;
      throw err;
    }

    const user = await get().hydrate();
    if (!user) {
      throw new Error("Google sign-in failed");
    }
    return user;
  },

  logout: async () => {
    await signOut({ redirect: false });
    set({ user: null, sessionExpired: false, loading: false });
  },

  refreshUser: async () => get().hydrate(),
}));
