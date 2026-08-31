# E01 — Transactional email (Resend)

**Status:** 📋 Planning — **not started**  
**Provider:** [Resend](https://resend.com) (`resend` npm package)  
**Priority rule:** **Security first** — tokens never in logs; rate limits on all public send triggers.  
**Execution rule:** One phase → test gate → next phase. Billing custom-request (B0) depends on EM0 + EM2.

| | |
|--|--|
| **Scope** | All product email: auth, onboarding, billing notices, admin alerts |
| **Today** | **No** transactional email — credentials login only; no verify / reset / OTP |
| **Billing tie-in** | Custom plan request → admin notify — see [`BILLING_SAFEPAY.md`](./BILLING_SAFEPAY.md) §3.6 |

---

# Part 0 — One-page summary

## What we are building

A single **server-side email layer** (`lib/email/`) used by auth, billing, and onboarding. Resend sends HTML + text templates. Every send is logged (`EmailDeliveryLog`). Public-facing flows (reset, verify, OTP) use **short-lived hashed tokens** in DB — never store raw tokens.

## What we are not building (this program)

- Marketing / newsletter campaigns (Resend Audiences later)  
- Inbound email / reply parsing  
- SMS OTP (email only for now)  
- User-editable templates in admin UI (code templates in B0; optional CMS later)  
- Sending from client/browser (forbidden)

## Security invariants

1. **`RESEND_API_KEY` server-only** — never `NEXT_PUBLIC_`.  
2. **Rate limit** every endpoint that triggers email (register, forgot-password, resend-verify, custom-plan).  
3. **Tokens:** store SHA-256 hash + expiry; single use; constant-time compare.  
4. **No account enumeration** — forgot-password and verify-resend return same success copy whether email exists.  
5. **Links** use `AUTH_URL` / `NEXT_PUBLIC_APP_URL` canonical origin only.  
6. **PII in logs:** log template id + recipient domain hash, not full body.  
7. **Idempotent sends** where possible (same `idempotencyKey` → skip duplicate within window).  
8. **Bounce/complaint** — log Resend webhook later (EM4 optional); do not retry hard bounces blindly.

---

# Part 1 — Current system

| Area | Today |
|------|--------|
| Auth | Auth.js credentials + Google; `User.email` unique; **no** `emailVerified` gate |
| Password reset | **Not implemented** |
| Email verification | **Not implemented** |
| OTP / magic link | **Not implemented** |
| Welcome email | **Not implemented** |
| Billing email | **Not implemented** (planned with B0 custom request) |
| Admin notify | **Not implemented** |

**Implication:** Email work is a **horizontal platform** — implement once, wire from auth routes, billing routes, and onboarding jobs.

---

# Part 2 — Architecture

## 2.1 Module layout

```
lib/email/
  client.js              # Resend singleton; isEmailConfigured()
  send.js                # sendEmail({ template, to, data, idempotencyKey? })
  templates/
    index.js             # registry: template id → render fn
    welcome.jsx          # React Email or plain HTML strings
    verify-email.jsx
    password-reset.jsx
    login-alert.jsx      # optional
    otp.jsx              # 6-digit code variant
    custom-plan-admin.jsx
    payment-receipt.jsx  # B4+
    onboarding-day1.jsx  # EM3
  tokens.js              # createEmailToken, consumeEmailToken (shared)
  constants.js           # template ids, TTLs
```

**Package choice:** Start with **plain HTML strings** + shared layout partial (fastest). Upgrade to `@react-email/components` in EM1 if desired — not blocking.

## 2.2 `sendEmail` contract

```js
await sendEmail({
  template: 'password_reset',
  to: 'user@example.com',
  data: { name, resetUrl, expiresMinutes },
  idempotencyKey: 'password_reset:userId:hour', // optional
  tags: ['auth', 'password_reset'],
});
// → { ok: true, messageId } | throws EmailSendError
```

- If Resend not configured: **dev** logs to console + returns mock id; **production** throws / returns 503 on user-facing routes that require email.  
- From address: `EMAIL_FROM` (e.g. `Aide <noreply@yourdomain.com>`).  
- Reply-to: `EMAIL_REPLY_TO` optional (support inbox).

## 2.3 `EmailDeliveryLog` (Prisma)

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | |
| `template` | string | e.g. `password_reset` |
| `toEmail` | string | |
| `userId` | string? | |
| `status` | `QUEUED` \| `SENT` \| `FAILED` | |
| `providerMessageId` | string? | Resend id |
| `errorMessage` | string? | Truncated |
| `idempotencyKey` | string? | unique optional |
| `metadata` | Json? | Non-sensitive tags |
| `createdAt` | datetime | |

## 2.4 `EmailToken` (auth flows)

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | |
| `userId` | FK | |
| `type` | enum | `VERIFY_EMAIL` \| `PASSWORD_RESET` \| `OTP_LOGIN` |
| `tokenHash` | string | SHA-256 of raw token |
| `expiresAt` | datetime | |
| `usedAt` | datetime? | Single-use |
| `createdAt` | | |

Raw token returned **once** in API response / email link only. DB never stores plaintext.

---

# Part 3 — Email catalog (all flows)

| Template id | Trigger | Recipient | Phase |
|-------------|---------|-----------|-------|
| `welcome` | After register (credentials or first Google) | User | EM3 |
| `verify_email` | Register (if verification enabled) or resend | User | EM1 |
| `password_reset` | Forgot password submit | User | EM1 |
| `otp_login` | Optional “email me a code” login | User | EM1 optional |
| `login_alert` | New device / IP login (optional) | User | EM3 optional |
| `custom_plan_request_admin` | Custom plan form submitted | Admin (`BILLING_ADMIN_EMAIL`) | EM2 |
| `custom_plan_request_ack` | Same form (auto-reply) | User | EM2 |
| `payment_receipt` | SafePay `subscription_payment:complete` | User | B4 |
| `subscription_past_due` | Webhook `subscription:unpaid` | User | B4 |
| `onboarding_day1` | Cron 24h after first ACTIVE sub | User | EM3 |
| `onboarding_day3` | Cron 72h — “create your first agent” | User | EM3 |

**Onboarding sequence (EM3):** Drip is **opt-out later**; MVP sends welcome immediately + one nudge at 24h if no agent created. Respect `User.emailPreferences` (future) — default send product onboarding.

---

# Part 4 — Flow details

## 4.1 Email verification (post-register)

```
POST /api/auth/register
  → create User
  → create EmailToken VERIFY_EMAIL (24h TTL)
  → sendEmail verify_email with link /verify-email?token=…
  → return 201 (client: "Check your inbox")

GET /verify-email?token=… (page)
POST /api/auth/verify-email { token }
  → consume token → User.emailVerifiedAt = now
  → redirect /billing/plans (or /login)
```

**Gate policy (decide in EM1):**

- **Soft:** allow login before verify; banner + resend.  
- **Hard:** block product until verified (stricter; better for billing).  

**Recommendation:** Hard gate for **new** email/password users; Google users treated as verified (`emailVerifiedAt` set on first Google sign-in).

## 4.2 Password reset

```
POST /api/auth/forgot-password { email }
  → always 200 { ok: true } (no enumeration)
  → if user exists: create EmailToken PASSWORD_RESET (1h TTL), send password_reset

GET /reset-password?token=… (page)
POST /api/auth/reset-password { token, newPassword }
  → consume token → update password hash → invalidate other sessions (optional)
```

Rate limit: 5 / hour per IP + 3 / hour per email.

## 4.3 OTP login (optional EM1)

```
POST /api/auth/otp/request { email }
POST /api/auth/otp/verify { email, code }
```

6-digit code, 10 min TTL, max 5 attempts. Use same `EmailToken` type `OTP_LOGIN` with numeric code in hash payload or separate `OtpCode` table if simpler.

## 4.4 Custom plan request (billing)

See [`BILLING_SAFEPAY.md`](./BILLING_SAFEPAY.md) §3.6.

- Admin email: full form context + link to admin request detail.  
- User ack: “We received your request.”

## 4.5 Login alert (optional)

Fire on credentials login when `UserAgent` / IP fingerprint new (store `UserLoginEvent` lite table or compare last login IP). Easy to spam — **off by default** via `EMAIL_LOGIN_ALERTS=0`.

---

# Part 5 — Environment

```bash
# Resend — server only
RESEND_API_KEY=re_...
EMAIL_FROM="Aide <noreply@yourdomain.com>"
EMAIL_REPLY_TO=support@yourdomain.com

# Billing / sales notifications (comma-separated ok)
BILLING_ADMIN_EMAIL=sales@yourdomain.com

# Feature flags
EMAIL_VERIFICATION_REQUIRED=1      # 0 = soft / off for dev
EMAIL_LOGIN_ALERTS=0
EMAIL_ONBOARDING_DRIP=1

# Token TTLs (seconds) — optional overrides
# EMAIL_VERIFY_TTL_SEC=86400
# EMAIL_RESET_TTL_SEC=3600
# EMAIL_OTP_TTL_SEC=600
```

**Resend setup checklist:**

1. Add domain in Resend dashboard; publish DKIM + SPF DNS records.  
2. Verify domain before production sends.  
3. Sandbox: use `onboarding@resend.dev` recipient restriction until domain verified.

---

# Part 6 — API & UI surfaces

| Surface | Purpose |
|---------|---------|
| `/forgot-password` | Request reset form |
| `/reset-password` | New password form |
| `/verify-email` | Token consumption + success |
| `LoginForm` link | “Forgot password?” |
| `RegisterForm` | Post-register verify notice |
| Admin | No email UI in EM0 — logs in `EmailDeliveryLog` query later |

---

# Part 7 — Phased delivery

## Phase EM0 — Resend wiring

**Build**

- `resend` package + `lib/email/client.js`, `send.js`  
- `EmailDeliveryLog` model  
- `GET /api/health` includes `email: configured \| disabled`  
- Dev fallback: console log when no API key  

**Test gate**

- [ ] Unit: send mocked when no key  
- [ ] Integration: send test email in sandbox with key  
- [ ] API key never in client bundle scan  

**Exit:** Any feature can call `sendEmail`.

---

## Phase EM1 — Auth emails

**Build**

- `EmailToken` model + `tokens.js`  
- Forgot / reset password pages + APIs  
- Verify email flow + resend (`POST /api/auth/resend-verification`)  
- Optional OTP routes behind flag  
- Rate limits on all routes  

**Test gate**

- [ ] Reset link works; expired token rejected  
- [ ] Double submit reset → second token invalidates first (optional) or both work once  
- [ ] Forgot password same response for missing email  
- [ ] `npm run test:email-em1`  

**Exit:** Auth-complete email parity with standard SaaS.

---

## Phase EM2 — Billing & admin notify

**Build**

- Templates: `custom_plan_request_admin`, `custom_plan_request_ack`  
- Wire from `POST /api/billing/custom-request`  
- Admin notification on failed payment (optional stub for B4)  

**Depends on:** B0 `CustomPlanRequest` model  

**Test gate**

- [ ] Submit custom form → admin receives email (sandbox)  
- [ ] User receives ack  
- [ ] `emailSentAt` set on request row  
- [ ] Rate limit blocks spam  

**Exit:** Billing custom path operational.

---

## Phase EM3 — Onboarding & polish

**Build**

- `welcome` on register  
- `onboarding_day1` job (Vercel cron or `scripts/onboarding-email.mjs`)  
- Optional `login_alert`  
- `User.emailVerifiedAt` backfill for Google users migration  

**Test gate**

- [ ] Welcome sends once per user (idempotency)  
- [ ] Cron skips users who already created agent  
- [ ] Unsubscribe footer link (mailto or preferences stub)  

**Exit:** Lifecycle emails live.

---

## Phase EM4 — Hardening (optional)

- Resend webhooks: delivery, bounce, complaint → update `EmailDeliveryLog`  
- Admin page: recent deliveries (read-only)  
- Template preview in dev route (`/api/dev/email-preview` — admin only, non-prod)  

---

# Part 8 — Test matrix (selected)

| ID | Scenario | Expected |
|----|----------|----------|
| EM-T01 | No RESEND_API_KEY in prod forgot-password | 503 or queue retry message |
| EM-T02 | Valid reset token | Password updated |
| EM-T03 | Reused reset token | 400 invalid |
| EM-T04 | Expired verify token | 400 + resend CTA |
| EM-T05 | 10 forgot-password rapid | Rate limited |
| EM-T06 | Custom plan request | Admin + user emails |
| EM-T07 | Duplicate welcome idempotency | One EmailDeliveryLog SENT |

---

# Part 9 — File map

```
lib/email/...
lib/auth/email-tokens.js       # or lib/email/tokens.js
app/api/auth/forgot-password/route.js
app/api/auth/reset-password/route.js
app/api/auth/verify-email/route.js
app/api/auth/resend-verification/route.js
app/(auth)/forgot-password/page.jsx
app/(auth)/reset-password/page.jsx
app/(auth)/verify-email/page.jsx
prisma/schema.prisma             # EmailDeliveryLog, EmailToken
scripts/test-email-em1.mjs
.env.example                     # RESEND_*, EMAIL_*, BILLING_ADMIN_EMAIL
```

---

# Part 10 — Decisions to lock

| Question | Recommendation | Status |
|----------|----------------|--------|
| Provider | **Resend** | **Locked (user)** |
| Verify gate | Hard for email/password; Google auto-verified | Pending |
| OTP login | Optional EM1 — not MVP blocker | Pending |
| Login alerts | Off by default | Pending |
| From domain | Dedicated subdomain `noreply@` | Pending |
| Admin email | Single `BILLING_ADMIN_EMAIL` | Pending |

---

# Part 11 — Related docs

| Doc | Role |
|-----|------|
| [`BILLING_SAFEPAY.md`](./BILLING_SAFEPAY.md) | Custom plan request + payment emails |
| [`OPEN_SEQUENCE.md`](../OPEN_SEQUENCE.md) | Add E01 when execution starts |
| Auth `register` + `proxy.js` | Verify gate insertion |

---

*Document owner: engineering. Auth email PRs require security review (token handling + enumeration).*
