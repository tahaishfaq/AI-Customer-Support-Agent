# Auth UX Fix — No `mode` query, shared layout (flicker) + Proxy

**Status:** Phase 2 plans on **standby** until this is done.  
**Goal:** Stable auth chrome; `/login` ↔ `/register` without `?mode=` and without flicker.  
**Route gating:** use **`proxy.js` only** — do **not** use deprecated `middleware.js`.  
**API / errors:** follow [`NEXT_API_ERROR_CONVENTIONS.md`](NEXT_API_ERROR_CONVENTIONS.md) — Next built-ins first.  
**Client auth state (next):** Context → Zustand — [`AUTH_ZUSTAND_PLAN.md`](AUTH_ZUSTAND_PLAN.md)

---

## Problem

Today:

1. `/register` **redirects** to `/login?mode=register`
2. `AuthFlow` is a client component that syncs `mode` from URL + `router.replace`
3. Switching login ↔ register remounts / re-syncs client state → **flicker**
4. Shared chrome is in layout, but **page content** still drives mode via query → layout win is wasted
5. Project still has **`middleware.js`** (Next.js 16 deprecated name → **`proxy.js`**)

---

## Proxy rule (project-wide for this fix + later phases)

Next.js 16: Middleware renamed to **Proxy**. Same job, new file/export names.

| Do | Don't |
|----|--------|
| `proxy.js` at app root | `middleware.js` |
| `export function proxy(request)` | `export function middleware(...)` |
| Optimistic route redirects (cookie present?) | Treat Proxy as full session/auth source of truth for APIs |

**Proxy use cases (always here for page access):**

- Guest → `/dashboard` (and later `/agents`, etc.) → redirect `/login?next=...`
- Logged-in → `/`, `/login`, `/register` → redirect `/dashboard`

**Not Proxy’s job:**

- Zod body validation on APIs (stay in route handlers)
- bcrypt / JWT verify for `/api/*` (stay in `getUserFromRequest` / services)
- Google token verify

API routes still return **401** themselves; Proxy only protects **page** navigations early.

### Migrate in this fix

```
middleware.js  →  proxy.js
export function middleware  →  export function proxy
```

Optional: `npx @next/codemod@canary middleware-to-proxy .`

Matcher should include:

```js
export const config = {
  matcher: ["/", "/dashboard/:path*", "/login", "/register"],
};
```

(Later Phase 2: add `/agents/:path*`, `/chat`, `/analytics` to the same `proxy.js` — still no middleware.)

---

## Target architecture

```
app/(auth)/layout.jsx          ← FULL auth design shell (always stable)
  ├── left: Hapy logo + form column frame
  ├── children                    ← only heading + form for this route
  └── right: AuthVisualPanel

app/(auth)/login/page.jsx      ← Welcome back + LoginForm
app/(auth)/register/page.jsx   ← Create account + RegisterForm   (real page, NO redirect)
```

**URLs (no query mode):**

| Action | URL |
|--------|-----|
| Sign in | `/login` |
| Sign up | `/register` |
| Landing “Get started” | `/register` |
| Landing “Sign in” | `/login` |

Optional: keep `?next=/dashboard` only for post-login redirect — **not** for register/login mode.

---

## Why flicker goes away

Next.js **keeps `(auth)/layout` mounted** when navigating `/login` → `/register`.  
Only `children` swap → right panel + logo + grid **do not remount**.

Remove:

- `?mode=register`
- `AuthFlow` client mode state + `useSearchParams` + `router.replace`
- `register/page.jsx` redirect

---

## Changes (checklist)

### 1. Layout — own the design

`app/(auth)/layout.jsx` already has split + panel. Keep / polish:

- Grid, white form column, Hapy link, `AuthVisualPanel`
- Stable min-height wrapper for children (reduce jump if register is taller)

### 2. Pages — thin children only

**`/login`**

- Title + subtitle (“Welcome back” / …)
- `<LoginForm />`
- Footer link: `<Link href="/register">Create one</Link>`

**`/register`**

- Title + subtitle (“Create an account” / …)
- `<RegisterForm />`
- Footer link: `<Link href="/login">Log in</Link>`
- **Delete** `redirect("/login?mode=register")`

### 3. Forms — Link instead of callbacks

- Drop `onSwitchToLogin` / `onSwitchToRegister` buttons
- Use Next `<Link href="/login">` / `<Link href="/register">`

### 4. Remove `AuthFlow`

- Delete or stop using `components/auth/AuthFlow.jsx`
- Login page: no `Suspense` for searchParams (unless `next` is read elsewhere)

### 5. Landing + other links

- `LandingHero`: `Get started` → `/register` (not `/login?mode=register`)
- Any other `mode=register` references → `/register`

### 6. Proxy (replace middleware)

- Delete / rename `middleware.js` → **`proxy.js`**
- Export **`proxy`**, same redirect logic as today
- Match `/login` and `/register` (real pages, no `mode`)
- Guest `/dashboard` → `/login` (+ optional `?next=` only)
- Logged-in `/` | `/login` | `/register` → `/dashboard`

### 7. API responses + validation + errors (Next-first)

Full detail: [`NEXT_API_ERROR_CONVENTIONS.md`](NEXT_API_ERROR_CONVENTIONS.md)

- Drop `lib/api-response.js` (`ok` / `fail` / `created`) → use **`NextResponse.json(data, { status })`**
- Validation status = normal HTTP **400** (no custom `ValidationStatusCode`)
- Keep **Zod** schemas (Next auth docs recommend Zod; Next has no built-in validator)
- Do **not** port Express `AsyncHandler` / `next(err)` — Route Handlers use early `return NextResponse.json(...)` for expected errors
- Optional thin `withApiError` only if needed for unexpected 500s
- UI: `error.js` / `catchError` from `next/error` where useful (not try/catch wrapping whole pages)

---

## Out of scope

- Phase 2 dashboard / agents (standby)
- Auth API / Google **business** logic changes (only response/helper style)
- Visual redesign of colors (unless small polish while touching layout)
- Moving API JWT checks into Proxy (keep on API routes)
- Express-style middleware / AsyncHandler stack

---

## Test plan

1. Open `/login` — no flicker on load  
2. Click “Create one” → URL `/register`, right panel **does not flash**  
3. Click “Log in” → `/login`, same stability  
4. Direct visit `/register` works (no redirect to query mode)  
5. Landing Get started → `/register`  
6. Guest `/dashboard` → `/login` via **proxy** (optional `?next=` only)  
7. Logged-in `/login` or `/register` → `/dashboard` via **proxy**  
8. Confirm **`middleware.js` is gone**; only **`proxy.js`** exists  
9. Auth APIs still return correct HTTP statuses via `NextResponse.json` (400/401/409/201)  
10. Hard refresh both auth routes OK  

---

## Implement order

1. Migrate `middleware.js` → `proxy.js` (`export function proxy`)  
2. Refactor auth routes: `NextResponse.json` + statuses; remove `api-response` helpers  
3. Fix register page + login page content  
4. Forms use `<Link>`  
5. Remove AuthFlow + mode usage  
6. Landing links  
7. Optional `error.js` for auth/app segments  
8. Manual browser test flicker + proxy redirects + Postman status check
