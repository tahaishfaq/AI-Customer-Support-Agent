# Session expiry UX — plan (Zustand, not Context Provider)

**Status:** Implemented (`sessionExpired` in Zustand + `SessionExpiredOverlay`)  
**Goal:** Jab 7-day JWT/session expire ho, user ko clear **“Session expired”** UI + **hard refresh** button mile.  
**Stack fit:** Zustand + cookie (`hapy_token`) — **naya React Context SessionProvider nahi** (auth already Zustand pe hai).

---

## Reality check (important)

| What you have | What it means |
|---------------|----------------|
| JWT `expiresIn: 7d` | Token 7 din baad invalid |
| Cookie `maxAge: 7 days` | Browser cookie bhi ~7 din |
| httpOnly cookie | Client JWT decode / silent refresh **nahi** kar sakta |
| No refresh-token API | Expire ke baad **naya session bina login ke** nahi banega |

Is liye “session refresh” = **page hard reload + `/api/auth/me` dubara**  
- Agar cookie/JWT ab bhi valid → user wapas aa jata hai  
- Agar expire → overlay / redirect **login** (password/Google dubara)

Silent auto-login expire ke baad **possible nahi** without refresh tokens (out of scope).

---

## What NOT to build

- React `SessionProvider` / `useContext` (avoid — Zustand rule)  
- Fake “refresh” that mints JWT without credentials  
- Polling every second (waste)

---

## What TO build

### 1. Auth store — session flags

Extend `store/auth-store.js`:

```js
sessionExpired: false,  // true when we detect expired/invalid session

markSessionExpired: () => set({ user: null, sessionExpired: true, loading: false }),

clearSessionExpired: () => set({ sessionExpired: false }),

// hydrate: on 401 while we previously had a user OR on app routes → markSessionExpired
// logout: clear sessionExpired too
```

### 2. `apiFetch` — detect 401 globally

In `lib/api-client.js` (client-only usage today):

- Agar `response.status === 401` **aur** path protected feel (not login/register):
  - `useAuthStore.getState().markSessionExpired()`
- Skip marking on intentional unauth calls during guest hydrate (first `/me` with no user yet)

Rule:

```
401 on /api/auth/me after user was logged in  → sessionExpired
401 on any /api/* while user != null         → sessionExpired
401 on first hydrate with no user            → just user=null (normal guest)
```

### 3. UI — `SessionExpiredOverlay` (not Context Provider)

`components/session/SessionExpiredOverlay.jsx`

- Render from `providers.jsx` next to `AuthHydrate` + `Toaster`
- Visible when `useAuthStore(s => s.sessionExpired)`
- Copy:
  - Title: **Session expired**
  - Body: Your session has ended. Refresh to continue, or sign in again.
  - Primary button: **Refresh** → `window.location.reload()` (hard refresh)
  - Secondary: **Sign in** → clear flag, `router.push('/login')` (+ optional `?next=`)

Blocking overlay (full-screen dim) so user doesn’t keep clicking dead APIs.

### 4. Optional: Proxy already helps

Expired cookie/JWT:

- Guest `/dashboard` → Proxy → `/login` on next **navigation**
- Overlay covers case jab user **page pe hi** baitha hai aur API 401 aati hai (bina navigate kiye)

### 5. Align expiry (already OK — verify)

| Piece | Value |
|-------|--------|
| `JWT_EXPIRES_IN` | `7d` (`.env`) |
| Cookie `maxAge` | `7 * 24 * 60 * 60` |

Keep both **same**. Doc in `.env.example` comment.

---

## Flow diagram

```
User logged in (Zustand user set)
        │
        ▼
API call → 401 (JWT expired / cookie gone)
        │
        ▼
markSessionExpired()
        │
        ▼
SessionExpiredOverlay
   ├─ Refresh → location.reload()
   │     └─ AuthHydrate → /me
   │           ├─ 200 → clear flag, continue
   │           └─ 401 → still expired → show overlay again OR go /login
   └─ Sign in → /login
```

---

## Files

| File | Change |
|------|--------|
| `store/auth-store.js` | `sessionExpired` + mark/clear |
| `lib/api-client.js` | 401 → mark when appropriate |
| `components/session/SessionExpiredOverlay.jsx` | **new** UI |
| `components/providers.jsx` | mount overlay |
| `bruno/` | optional note; no new API |

No new API route required.

---

## Implement order

1. Store flags  
2. `apiFetch` 401 hook  
3. Overlay UI + wire in `Providers`  
4. Manual test: short JWT in `.env` (`JWT_EXPIRES_IN=30s`) → wait → call `/me` or any API → overlay  
5. Restore `7d` after test  

---

## Test plan

| Step | Expect |
|------|--------|
| Temp `JWT_EXPIRES_IN=30s`, login, wait 35s, open dashboard / call Me | Overlay “Session expired” |
| Click **Refresh** | Full reload; if still dead → login or overlay again |
| Click **Sign in** | `/login` |
| Normal 7d session, fresh login | Overlay kabhi nahi |
| Guest visits landing | No overlay |

---

## Out of scope (later)

- Refresh-token rotation  
- Sliding session (extend JWT on each request)  
- React Context SessionProvider  

---

## Name clarity

User ne “Session Provider” kaha — is plan mein yeh **`SessionExpiredOverlay` + Zustand flags** hai, Context Provider nahi. Same UX, project conventions ke saath.
