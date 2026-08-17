# Phase 1 Frontend — Landing + Auth UI (+ Google)

**Scope now:** Pages + auth UI (JavaScript `.jsx`) + small backend cookie update  
**Depends on:** Phase 1 Backend auth APIs (done)  
**Token storage:** **httpOnly cookies** (not localStorage)  
**App:** `AI-Customer-Support-Agent`  
**UI reference:** [Botpress](https://botpress.com/)  
**Components:** shadcn/ui + existing `globals.css` tokens  

**Out of scope:** Agents CRUD, chat, knowledge, analytics charts (later phases).  
Dashboard in this phase = **simple shell** after login (welcome + logout + placeholder links). Full KPIs = Phase 5.

---

## Goal (user journey)

```
Landing (/)
   → Get Started / Login / Register
        → Auth (email OR Google)
             → Backend sets httpOnly cookie
             → Dashboard shell (/dashboard)
                  → Logout clears cookie → Landing
```

User can:

1. See a clean **marketing landing page**  
2. **Register** (name, email, password, confirm)  
3. **Login** (email, password)  
4. **Sign in with Google**  
5. Stay logged in via **httpOnly cookie**  
6. Access **protected** `/dashboard`  
7. **Logout** (cookie cleared by server)  

---

## Auth approach — httpOnly cookies (chosen)

### Why cookies

- Safer than localStorage (JS cannot read token → better against XSS)  
- Same Next.js origin (`localhost:3000`) → cookie auto-sent to `/api/*`  
- Logout can clear cookie on the server  

### Flow

```
Login / Register / Google success
        ↓
Backend signs JWT
        ↓
Set-Cookie: hapy_token=<jwt>; HttpOnly; Path=/; SameSite=Lax
(+ Secure in production)
        ↓
Response body: { user }   (token still OK in JSON for Postman, optional)
        ↓
Browser stores cookie automatically
        ↓
Later API calls / pages: cookie sent automatically
        ↓
getUserFromRequest reads cookie (or Bearer fallback)
        ↓
Logout → Clear-Cookie + 200
```

### Backend tweak (do before / with frontend)

Update existing auth helpers/routes:

| Change | Detail |
|--------|--------|
| Cookie name | `hapy_token` |
| Set cookie | On register, login, google success |
| Clear cookie | On logout |
| Read auth | Cookie **first**, then `Authorization: Bearer` (Postman still works) |
| Cookie flags | `httpOnly: true`, `path: /`, `sameSite: "lax"`, `secure: production`, `maxAge` ≈ JWT expiry |

New/updated helpers:

- `lib/auth-cookie.js` — `setAuthCookie(response, token)`, `clearAuthCookie(response)`, `getTokenFromRequest(request)`  
- Update `getUserFromRequest` to use cookie OR Bearer  
- Update register / login / google / logout route responses to set/clear cookie  

Frontend `fetch` / `apiFetch` must use:

```js
credentials: "include"
```

### Middleware (protect dashboard)

`middleware.js` checks for `hapy_token` cookie:

- No cookie on `/dashboard` → redirect `/login`  
- Cookie present on `/login` or `/register` → redirect `/dashboard`  

---

## Pages & routes

| Route | Auth? | Page |
|-------|-------|------|
| `/` | Public | **Landing page** (hero + CTAs) |
| `/login` | Public | Login form + Google button |
| `/register` | Public | Register form + Google button |
| `/dashboard` | Protected (cookie) | Simple post-login shell |
| `/api/*` | Cookie or Bearer | Existing APIs (+ cookie set/clear) |

**Redirect rules:**

- Logged-in (`hapy_token`) visits `/login` or `/register` → `/dashboard`  
- Not logged-in visits `/dashboard` → `/login`  
- After successful auth → `/dashboard`  
- Logout → `/` (landing)  

---

## Design direction

Inspired by Botpress — calm, product-like, spacious.

### Landing (`/`) — first viewport (keep simple)

One composition only:

1. **Brand:** Hapy (hero-level)  
2. **One headline**  
3. **One short supporting sentence**  
4. **CTA group:** Get Started → `/register` · Sign in → `/login`  
5. Soft background using CSS vars (no purple glow, no clutter in hero)

Optional below fold:

- How it works (3 steps: Agent → Chat → Insights)  
- Footer  

### Auth pages

- Centered Card (shadcn)  
- Teal primary from `globals.css`  
- Divider: “or continue with Google”  
- Loading / error states  
- Link Login ↔ Register  

### Dashboard shell (Phase 1 only)

- Header: Hapy + user name + Logout  
- Welcome message  
- Placeholder: “Agents & analytics coming next”  
- No real KPIs yet  

---

## Env

```env
# already have
GOOGLE_CLIENT_ID=...

# add for Google button in browser
NEXT_PUBLIC_GOOGLE_CLIENT_ID=same-value-as-GOOGLE_CLIENT_ID
```

Restart `npm run dev` after adding.

---

## Files to create / update

### Backend cookie support

| File | Role |
|------|------|
| `lib/auth-cookie.js` | set / clear / read cookie |
| `lib/auth.js` | `getUserFromRequest` → cookie OR Bearer |
| `app/api/auth/register/route.js` | set cookie on success |
| `app/api/auth/login/route.js` | set cookie on success |
| `app/api/auth/google/route.js` | set cookie on success |
| `app/api/auth/logout/route.js` | clear cookie |
| `middleware.js` | protect `/dashboard`, redirect auth pages |

### Frontend

| File | Role |
|------|------|
| `app/page.js` | **Landing page** |
| `app/(auth)/layout.jsx` | Centered auth layout |
| `app/(auth)/login/page.jsx` | Login + Google |
| `app/(auth)/register/page.jsx` | Register + Google |
| `app/(app)/layout.jsx` | App shell layout |
| `app/(app)/dashboard/page.jsx` | Dashboard shell |
| `components/auth/LoginForm.jsx` | Email/password login |
| `components/auth/RegisterForm.jsx` | Register form |
| `components/auth/GoogleSignInButton.jsx` | GIS → `/api/auth/google` |
| `components/landing/LandingHero.jsx` | Hero |
| `components/landing/LandingHowItWorks.jsx` | Optional section |
| `components/layout/AppHeader.jsx` | Header + logout |
| `context/AuthContext.jsx` | user + loading via `/api/auth/me` (no token in JS) |
| `lib/api-client.js` | `apiFetch` with `credentials: "include"` |
| `components/providers.jsx` | AuthProvider + Toaster |
| `app/layout.js` | Include providers |

**Removed from plan:** `lib/auth-storage.js` / localStorage token helpers.

---

## AuthContext (cookie-based)

- On load: `GET /api/auth/me` with `credentials: "include"`  
- If 200 → set `user`  
- If 401 → `user = null`  
- Login/register/google: call API → on success refresh user from `/me` or use returned `user` → redirect `/dashboard`  
- Logout: `POST /api/auth/logout` → clear local user state → `/`  
- **Never** store JWT in `localStorage` / React state  

---

## Forms & validation

### Register → `POST /api/auth/register` (`credentials: "include"`)

Name required · valid email · password min 8 · confirm match  
→ cookie set by server → `/dashboard`

### Login → `POST /api/auth/login`

→ cookie set → `/dashboard`

### Google

1. GIS button with `NEXT_PUBLIC_GOOGLE_CLIENT_ID`  
2. `POST /api/auth/google` `{ idToken }` + `credentials: "include"`  
3. Cookie set → `/dashboard`

### Logout

`POST /api/auth/logout` + `credentials: "include"` → cookie cleared → `/`

---

## UI states (required)

| State | Behavior |
|-------|----------|
| Loading | Disable submit / spinner |
| Error | Inline API `error.message` |
| Success | Redirect `/dashboard` |

---

## Implementation order

1. Backend cookie helpers + update auth routes + middleware  
2. `api-client` (`credentials: "include"`) + AuthContext + providers  
3. Landing page  
4. Login + Register (email/password)  
5. Google button  
6. Dashboard shell + logout  
7. Browser test checklist  
8. Update `api-contract.md` (cookie note)  

---

## Manual test checklist

- [ ] Landing at `/`  
- [ ] Register → cookie set → dashboard  
- [ ] DevTools → Application → Cookies → `hapy_token` (HttpOnly)  
- [ ] Duplicate email error  
- [ ] Login → dashboard  
- [ ] Wrong password error  
- [ ] Google Sign-In → dashboard  
- [ ] Refresh stays logged in (cookie)  
- [ ] `/dashboard` without cookie → `/login`  
- [ ] Logged-in `/login` → `/dashboard`  
- [ ] Logout clears cookie → landing  
- [ ] Mobile layout OK  

---

## NOT in this phase

- Agents / chat / knowledge / analytics  
- Full sidebar (header only)  

---

## Definition of Done

- [ ] Landing live  
- [ ] Register / Login / Google work  
- [ ] JWT in **httpOnly cookie** (not localStorage)  
- [ ] Protected dashboard + logout clear cookie  
- [ ] Loading + error states  
- [ ] Botpress-inspired clean UI  

---

## After you approve

1. Implement cookie support on backend  
2. Implement Phase 1 Frontend  
3. Phase 1 complete → Phase 2 (Agents)  
