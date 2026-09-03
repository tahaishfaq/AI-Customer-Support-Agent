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

function userFromIdToken(idToken) {
  try {
    const payload = idToken?.split?.(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const email = String(json.email || "").trim().toLowerCase();
    if (!email) return null;
    return {
      id: json.sub || null,
      name: json.name || email.split("@")[0],
      email,
      role: "USER",
    };
  } catch {
    return null;
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
  adminNeedsSeed,
  rateLimited,
}) {
  const rejected = restoreStatus === "REJECTED";
  const err = new Error(
    rateLimited
      ? "Too many admin login attempts. Wait about 15 minutes, then try email + password again."
      : adminNeedsSeed
        ? "Admin password is not set. Run npm run seed:admin against this database (same DATABASE_URL as the app)."
        : adminPasswordOnly
          ? "Admins sign in with email + password on /login — Google is not allowed for the operator account."
          : signupsClosed
            ? "Signups closed"
            : suspended
              ? rejected
                ? "This account is still suspended. Your restore request was rejected."
                : "This account was disabled by an admin."
              : google
                ? "Google sign-in failed"
                : "Invalid email or password"
  );
  err.status = rateLimited ? 429 : 401;
  err.code = rateLimited
    ? "RATE_LIMITED"
    : adminNeedsSeed
      ? "ADMIN_NEEDS_SEED"
      : adminPasswordOnly
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
      const rateLimited =
        result.code === "too_many_attempts" ||
        String(result.error || "").includes("too_many_attempts");
      const adminNeedsSeed =
        result.code === "admin_needs_seed" ||
        String(result.error || "").includes("admin_needs_seed");
      let suspended =
        result.code === "account_suspended" ||
        String(result.error || "").includes("account_suspended");
      let restoreStatus = null;
      if (!adminNeedsSeed) {
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
        rateLimited,
        adminNeedsSeed,
      });
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

    const optimistic = userFromIdToken(idToken);
    if (optimistic) {
      set({ user: optimistic, loading: false, sessionExpired: false });
    }

    void get()
      .hydrate()
      .then((user) => {
        if (user?.role === "ADMIN") {
          void get().logout();
        }
      });

    return optimistic || (await get().hydrate());
  },

  logout: async () => {
    await signOut({ redirect: false });
    set({ user: null, sessionExpired: false, loading: false });
  },

  refreshUser: async () => get().hydrate(),
}));
