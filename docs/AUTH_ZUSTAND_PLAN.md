# Auth state: Context → Zustand

**Status:** Implemented in app (`store/auth-store.js`, `AuthHydrate`)  
**Scope:** Replace `context/AuthContext.jsx` (`useContext`) with **Zustand**  
**Keep:** httpOnly cookie `hapy_token`, `apiFetch`, Proxy redirects, Zod, `NextResponse.json`  
**Out of scope:** Phase 2 dashboard/agents (still standby)

---

## Why

| Today (Context) | Target (Zustand) |
|-----------------|------------------|
| `AuthProvider` wraps whole tree | No auth Provider required |
| `useAuth()` via `useContext` | `useAuthStore()` selectors |
| Re-renders tied to context value | Subscribe only to needed slices (`user`, `loading`, …) |
| Extra `useCallback` / `useMemo` | Store actions are plain functions |

Auth session **source of truth** remains the **cookie + `/api/auth/me`**. Zustand only holds the **client user snapshot** and auth actions.

---

## Current consumers (migrate these)

| File | Uses |
|------|------|
| `components/providers.jsx` | `AuthProvider` |
| `components/auth/LoginForm.jsx` | `login` |
| `components/auth/RegisterForm.jsx` | `register` |
| `components/auth/GoogleSignInButton.jsx` | `loginWithGoogle` |
| `components/layout/AppHeader.jsx` | `user`, `logout`, `loading` |
| `app/(app)/dashboard/page.jsx` | `user`, `loading` |

---

## Target shape

### Package

```bash
npm install zustand
```

### New file: `store/auth-store.js`

```js
"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/api-client";

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true, // true until first /me hydrate

  isAuthenticated: () => Boolean(get().user),
  // or derived in selectors: Boolean(useAuthStore(s => s.user))

  hydrate: async () => {
    try {
      const data = await apiFetch("/api/auth/me");
      set({ user: data.user, loading: false });
      return data.user;
    } catch {
      set({ user: null, loading: false });
      return null;
    }
  },

  login: async (email, password) => {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    set({ user: data.user, loading: false });
    return data.user;
  },

  register: async (payload) => {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    set({ user: data.user, loading: false });
    return data.user;
  },

  loginWithGoogle: async (idToken) => {
    const data = await apiFetch("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    set({ user: data.user, loading: false });
    return data.user;
  },

  logout: async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // clear local anyway
    }
    set({ user: null });
  },

  refreshUser: async () => get().hydrate(),
}));
```

**Do not** persist JWT in Zustand / localStorage — cookie stays httpOnly.

### Optional thin hook (API compatibility)

```js
// store/use-auth.js — optional alias so call sites stay readable
export function useAuth() {
  return useAuthStore();
}
```

Prefer **selectors** to avoid extra re-renders:

```js
const user = useAuthStore((s) => s.user);
const login = useAuthStore((s) => s.login);
```

---

## Bootstrap (replace AuthProvider)

Context `useEffect` hydrate → small client bootstrap once:

**Option A (recommended):** `components/AuthHydrate.jsx`

```jsx
"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";

export function AuthHydrate() {
  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);
  return null;
}
```

**`providers.jsx`:**

```jsx
export function Providers({ children }) {
  return (
    <>
      <AuthHydrate />
      {children}
      <Toaster />
    </>
  );
}
```

No `AuthProvider` / no Context.

---

## Call-site updates

```diff
- import { useAuth } from "@/context/AuthContext";
- const { login } = useAuth();
+ import { useAuthStore } from "@/store/auth-store";
+ const login = useAuthStore((s) => s.login);
```

Same for `register`, `loginWithGoogle`, `logout`, `user`, `loading`.

---

## Delete after migrate

- `context/AuthContext.jsx`
- Empty `context/` folder if unused
- Any `AuthProvider` import

---

## Rules

1. **Zustand** for client auth UI state only  
2. **Proxy** still gates pages (cookie check)  
3. **APIs** still validate JWT with `getUserFromRequest`  
4. No Express-style Context / no custom ValidationStatusCode  
5. Keep error body contract + `NextResponse.json`  

---

## Implement order

1. `npm install zustand`  
2. Add `store/auth-store.js` + `AuthHydrate`  
3. Update `providers.jsx`  
4. Update 5 consumers (forms, Google, header, dashboard)  
5. Delete `AuthContext.jsx`  
6. Test: refresh while logged in, login, register, logout, Google (if configured)

---

## Test plan

| Step | Expect |
|------|--------|
| Guest open `/login` | `loading` → false, `user` null |
| Login / register | `user` set, redirect dashboard |
| Hard refresh dashboard | hydrate `/me` → welcome name shows |
| Logout | cookie cleared, `user` null, land login |
| No `useContext` / `AuthProvider` in app auth path | grep clean |

---

## Phase 2 note (standby)

Later agents/dashboard client state can also use Zustand stores (`store/agents-store.js`, etc.) the same way — **not** new Context providers.
