"use client";

import { create } from "zustand";
import { getSession, signIn, signOut } from "next-auth/react";
import { apiFetch } from "@/lib/api-client";

function emailFromIdToken(idToken) {
  try {
    const payload = idToken?.split?.(".")[1];
    if (!payload) return "";
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return String(json.email || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

async function suspendedHint(email) {
  if (!email) return { suspended: false, restoreStatus: null };
  try {
    const hint = await apiFetch("/api/auth/suspended-check", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return {
      suspended: Boolean(hint?.suspended),
      restoreStatus: hint?.restoreStatus || null,
    };
  } catch {
    return { suspended: false, restoreStatus: null };
  }
}

function throwLoginError({
  suspended,
  restoreStatus,
  email,
  google,
  signupsClosed,
  adminPasswordOnly,
}) {
  const rejected = restoreStatus === "REJECTED";
  const err = new Error(
    adminPasswordOnly
      ? "Admins can only sign in with email and password."
      : signupsClosed
        ? "New signups are closed. Use an account that already exists."
        : suspended
          ? rejected
            ? "This account is still suspended. Your restore request was rejected."
            : "This account was disabled by an admin."
          : google
            ? "Google sign-in failed"
            : "Invalid email or password"
  );
  err.status = 401;
  err.code = adminPasswordOnly
    ? "ADMIN_PASSWORD_ONLY"
    : signupsClosed
      ? "SIGNUPS_CLOSED"
      : suspended
        ? "SUSPENDED"
        : "AUTH";
  err.restoreStatus = restoreStatus || null;
  if (email) err.email = email;
  throw err;
}

function toStoreUser(sessionUser) {
  if (!sessionUser?.id && !sessionUser?.email) return null;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    role: sessionUser.role || "USER",
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
      let suspended =
        result.code === "account_suspended" ||
        String(result.error || "").includes("account_suspended");
      let restoreStatus = null;
      const hint = await suspendedHint(email);
      if (hint.suspended) {
        suspended = true;
        restoreStatus = hint.restoreStatus;
      }
      throwLoginError({ suspended, restoreStatus, email });
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
    const email = emailFromIdToken(idToken);
    const result = await signIn("google-id-token", {
      idToken,
      redirect: false,
    });

    if (result?.error) {
      const signupsClosed =
        result.code === "signups_closed" ||
        String(result.error || "").includes("signups_closed");
      const adminPasswordOnly =
        result.code === "admin_password_only" ||
        String(result.error || "").includes("admin_password_only");
      let suspended =
        result.code === "account_suspended" ||
        String(result.error || "").includes("account_suspended");
      let restoreStatus = null;
      if (!signupsClosed && !adminPasswordOnly) {
        const hint = await suspendedHint(email);
        if (hint.suspended) {
          suspended = true;
          restoreStatus = hint.restoreStatus;
        }
      }
      throwLoginError({
        suspended,
        restoreStatus,
        email,
        google: true,
        signupsClosed,
        adminPasswordOnly,
      });
    }

    const user = await get().hydrate();
    if (!user) {
      throw new Error("Google sign-in failed");
    }
    if (user.role === "ADMIN") {
      await get().logout();
      throwLoginError({
        google: true,
        adminPasswordOnly: true,
        email: user.email,
      });
    }
    return user;
  },

  logout: async () => {
    await signOut({ redirect: false });
    set({ user: null, sessionExpired: false, loading: false });
  },

  refreshUser: async () => get().hydrate(),
}));
