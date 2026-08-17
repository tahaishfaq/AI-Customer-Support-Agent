# Phase 1 Backend — Auth (+ Google Sign-In)

**Scope now:** API + DB + auth helpers only (JavaScript)  
**Out of scope now:** Login/Register UI, Google button (→ Phase 1 Frontend — next plan)  
**App:** `AI-Customer-Support-Agent`  
**Base contract:** [`api-contract.md`](api-contract.md) (extend with Google + me)

---

## Goal

User can:

1. Register with email/password  
2. Login with email/password  
3. Login with **Google** (ID token)  
4. Logout  
5. Call protected APIs with `Authorization: Bearer <jwt>`

Frontend pages come **after** this backend is tested.

---

## Auth approach (chosen)

**One JWT for everything** — no NextAuth for MVP.

```
Email register/login  ──┐
                        ├──► verify ──► User in Neon ──► sign app JWT ──► { user, token }
Google ID token       ──┘
```

### Google (backend)

1. Frontend (later) sends Google **ID token** (`credential`) from Google Identity Services  
2. Backend verifies with `google-auth-library` + `GOOGLE_CLIENT_ID`  
3. Read `email`, `name`, `sub` (Google user id)  
4. Find/create user (`googleId` / email)  
5. Return **same** `{ user, token }` as email login  

---

## 1. Schema change

`passwordHash` must be optional (Google-only users have no password).

```prisma
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String?          // null = Google-only
  googleId     String?  @unique // Google "sub"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  agents       Agent[]
}
```

```bash
npx prisma migrate dev --name auth_google_fields
npx prisma generate
```

---

## 2. Packages

```bash
npm install bcrypt jsonwebtoken zod google-auth-library
```

---

## 3. Env vars

Add to `.env` + `.env.example`:

```env
JWT_SECRET=use-a-long-random-secret
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

Create Web Client ID: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID → Web application.  
Same Client ID will be used on frontend later.

---

## 4. Files to create

| File | Role |
|------|------|
| `lib/api-response.js` | success / error helpers (contract shape) |
| `lib/auth.js` | hash, compare, signToken, verifyToken, getUserFromRequest |
| `lib/validations/auth.js` | Zod: register, login, google |
| `lib/services/auth.service.js` | register / login / googleLogin logic |
| `app/api/auth/register/route.js` | POST |
| `app/api/auth/login/route.js` | POST |
| `app/api/auth/logout/route.js` | POST (JWT required) |
| `app/api/auth/google/route.js` | POST (new) |
| `app/api/auth/me/route.js` | GET current user (JWT required) |

---

## 5. Endpoints

### `POST /api/auth/register` (public)

Body: `name`, `email`, `password`, `confirmPassword`  
Rules: password min 8, passwords match, unique email  
→ **201** `{ user, token }` · **409** duplicate · **400** validation  

> **Update for Phase 1 Frontend:** also set **httpOnly cookie** `hapy_token` (see frontend plan). Cookie OR Bearer both accepted on protected routes.

### `POST /api/auth/login` (public)

Body: `email`, `password`  
→ **200** `{ user, token }` · **401** wrong / missing / Google-only (no password)  
> Also sets `hapy_token` httpOnly cookie (Phase 1 Frontend).

### `POST /api/auth/logout` (protected)

Cookie or Bearer JWT required  
→ **200** `{ message: "Logged out successfully" }` + **clear** `hapy_token` cookie  

### `POST /api/auth/google` (public, **new**)

```json
{ "idToken": "<google-credential-jwt>" }
```

Rules:

- Verify audience = `GOOGLE_CLIENT_ID`  
- Email must be present/verified  
- Match by `googleId`, else link by `email`, else create (`passwordHash: null`)  
→ **200** `{ user, token }` + set `hapy_token` cookie · **401** invalid token  

### `GET /api/auth/me` (protected)

Cookie or Bearer  
→ **200** `{ user }` · **401** if no/invalid token  

### Error format (all)

```json
{ "error": { "message": "...", "details": {} } }
```

---

## Cookie auth (Phase 1 Frontend follow-up)

Token storage decision: **httpOnly cookies** (not localStorage).

| Item | Value |
|------|--------|
| Cookie name | `hapy_token` |
| Flags | `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` in production |
| Set on | register, login, google |
| Clear on | logout |
| Read order | cookie first, then `Authorization: Bearer` |

Full UI plan: [`PHASE1_FRONTEND_PLAN.md`](PHASE1_FRONTEND_PLAN.md)
---

## 6. Implementation order

1. Migrate User schema  
2. Helpers: `api-response`, `auth.js`, Zod, `auth.service.js`  
3. register / login / logout / me  
4. google route + `GOOGLE_CLIENT_ID`  
5. Update `api-contract.md`  
6. Test with curl/Postman  
7. **Stop** → then Phase 1 Frontend plan  

---

## 7. Backend test checklist

- [x] Register → 201 + token  
- [x] Duplicate email → 409  
- [x] Login ok → 200  
- [x] Wrong password → 401  
- [ ] Google-only user password-login → 401 *(after first Google login)*  
- [x] `/api/auth/me` with token → 200  
- [x] `/api/auth/me` without token → 401  
- [x] Logout → 200  
- [ ] Google invalid token → 401 *(set `GOOGLE_CLIENT_ID` first)*  
- [ ] Google valid ID token → 200 + token *(set `GOOGLE_CLIENT_ID` + frontend)*  

**Status:** Email/password auth APIs implemented and verified. Google route is ready — add `GOOGLE_CLIENT_ID` in `.env` to enable.

---

## NOT in this phase

- Login / Register pages  
- Google button / GIS script  
- localStorage / cookies UI  
- Protected route layout  

→ **Phase 1 Frontend** (separate plan after backend is done)

---

## When ready

Approve this backend plan → implement Phase 1 Backend → then plan Phase 1 Frontend (forms + Google button).
