# Next.js conventions — responses, validation, errors

**Applies to:** Auth UX fix + Phase 2+ (standby)  
**Rule:** Jo Next.js provide karta hai woh use karo. Jo nahi hai, tabhi chhota custom banao. Express-style wrappers avoid.

Sources (Next 16 docs):

- [Error Handling](https://nextjs.org/docs/app/getting-started/error-handling)
- [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [`NextResponse`](https://nextjs.org/docs/app/api-reference/functions/next-response)
- [Authentication (Zod)](https://nextjs.org/docs/app/guides/authentication)
- [`error.js` / `catchError`](https://nextjs.org/docs/app/api-reference/functions/catchError)
- [Proxy](https://nextjs.org/docs/app/getting-started/proxy) (ex-middleware)

---

## 1. API responses — use Next, drop custom helpers

**Remove / stop using:** `lib/api-response.js` (`ok`, `created`, `fail`).

**Use Next built-in:**

```js
import { NextResponse } from "next/server";

// success
return NextResponse.json({ user, token }, { status: 200 });
return NextResponse.json(agent, { status: 201 });
return new NextResponse(null, { status: 204 }); // delete

// error — HTTP status on Response, body stays api-contract shape
return NextResponse.json(
  { error: { message: "Validation failed", details: { email: "..." } } },
  { status: 400 }
);
```

Also valid per docs: `Response.json(data, { status })`.

**Status codes (standard HTTP — no custom ValidationStatusCode module):**

| Status | When |
|--------|------|
| 200 | OK |
| 201 | Created |
| 204 | No content (DELETE) |
| 400 | Validation failed |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (e.g. email taken) |
| 500 | Unexpected server error |

Body shape stays [`api-contract.md`](api-contract.md) `{ error: { message, details } }` — that is **contract**, not a Next “framework helper”. Status must match the table (validation → **400**, not a made-up code).

---

## 2. Validation — Zod (Next docs recommend it)

Next **does not** ship a validation library. Auth guide says use **Zod** (or Yup).

**Keep:** `lib/validations/*.js` + `safeParse` + field `details`.

**Do not build:** Express-style `ValidationStatusCode.js` enums that replace HTTP statuses.

Pattern:

```js
const parsed = loginSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: { message: "Validation failed", details: zodErrorDetails(parsed.error) } },
    { status: 400 }
  );
}
```

---

## 3. Error handling — Next vs Express AsyncHandler

### Express pattern (DO NOT port)

```js
// Express — next(err) + AsyncHandler
const AsyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

Next Route Handlers have **no** `next(err)` middleware chain.

### What Next provides (USE THESE)

| Layer | Next tool | Use for |
|-------|-----------|---------|
| UI routes | `app/**/error.js` | Uncaught render errors → fallback UI |
| Root | `app/global-error.js` | Root layout failures |
| Component | `catchError` from `next/error` | Granular UI boundaries |
| Missing data | `notFound()` + `not-found.js` | 404 UI |
| Auth UI (optional) | `unauthorized()` / `forbidden()` + flag | Only if we enable `authInterrupts` later |
| Server Actions | return `{ message }` + `useActionState` | Expected form errors (avoid throw for expected) |
| Page redirects | `redirect()` / Proxy | Auth page gates |

### Route Handlers (API) — expected vs unexpected

Docs: **expected** errors → return explicitly (no throw). **Unexpected** → throw / catch and respond.

```js
export async function POST(request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation failed", details: zodErrorDetails(parsed.error) } },
      { status: 400 }
    );
  }

  try {
    const result = await registerUser(parsed.data);
    const res = NextResponse.json(result, { status: 201 });
    setAuthCookie(res, result.token);
    return res;
  } catch (error) {
    if (error.status === 409) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 409 }
      );
    }
    console.error("POST /api/auth/register", error);
    return NextResponse.json(
      { error: { message: "Unable to register", details: {} } },
      { status: 500 }
    );
  }
}
```

**Optional thin helper (only if DRY needed — not Express AsyncHandler):**

```js
// lib/with-api-error.js — ONLY if we want less boilerplate; still returns NextResponse
export function withApiError(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error.status) {
        return NextResponse.json(
          { error: { message: error.message, details: error.details || {} } },
          { status: error.status }
        );
      }
      console.error(error);
      return NextResponse.json(
        { error: { message: "Internal server error", details: {} } },
        { status: 500 }
      );
    }
  };
}
```

Prefer **early returns** for 400/401; use `withApiError` only for unexpected throws. Do **not** invent a full Express middleware stack.

### UI (auth / dashboard)

- Add `error.js` where useful (e.g. `(app)/error.jsx`)
- Prefer `catchError` for nested UI if needed
- Client forms: keep local `error` state for fetch failures (event handlers are not caught by error boundaries — Next docs say so)

---

## 4. Route protection

- **Pages:** `proxy.js` (not `middleware.js`)
- **APIs:** `getUserFromRequest` → `NextResponse.json(..., { status: 401 })`

---

## 5. Auth UX fix — extra checklist items

Besides flicker / no `mode` / proxy migrate:

- [ ] Replace all `ok` / `fail` / `created` with `NextResponse.json` + status  
- [ ] Delete `lib/api-response.js` when unused  
- [ ] Keep Zod; status **400** for validation  
- [ ] No `ValidationStatusCode` / Express `AsyncHandler`  
- [ ] Optional: `(auth)/error.jsx` or `(app)/error.jsx` for UI  
- [ ] Document same conventions for Phase 2 when resumed  

---

## Decision summary

| Need | Next available? | Action |
|------|-----------------|--------|
| JSON + HTTP status | Yes — `NextResponse.json` | Use it; drop `api-response` helpers |
| Validation schemas | No built-in — docs say Zod | Keep Zod |
| Validation HTTP status | Standard HTTP | Use 400 (etc.), no custom status module |
| Express AsyncHandler | No | Early return + small catch; optional `withApiError` |
| UI crash recovery | Yes — `error.js`, `catchError` | Use these |
| Page auth redirect | Yes — Proxy | `proxy.js` |
