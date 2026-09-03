# B01 — Billing & subscriptions (SafePay)

**Status:** 🟡 **In progress — B0–B4 implemented in code; B5 partial; sandbox E2E + prod sign-off pending** (updated Sep 1, 2026 — O01 Orchestrator ✅; display name **Basic** for `planType=FREE`)  
**Replaces backlog sketch:** `[POST_MVP_BACKLOG_PLAN.md](../POST_MVP_BACKLOG_PLAN.md)` § **P3-BILLING** (was Stripe; **provider = SafePay**)  
**Priority rule:** **Security first.** Money paths must be correct before UX polish.  
**Execution rule:** One phase → automated + manual test → next phase. Never skip a test gate.  
**O01 invariant:** Billing / plan / suspend gates stay **above** Orchestrator (proxy/layout). Do **not** put plan checks inside `runTurn`. Entitlements (incl. future MCP server caps) enforce at API/config load, not in the tool loop.


|                 |                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **Provider**    | [SafePay](https://getsafepay.com) — hosted subscription checkout (`@sfpy/node-sdk`)                          |
| **Plans**       | **Exactly 4** fixed slots — **Basic** (`FREE`) | **Popular** | **Teams** | **Custom** (Botpress-style pricing grid)    |
| **Who pays**    | **User** (Aide account), not Workspace                                                                       |
| **When**        | After register / first Google signup — **before** dashboard / agent onboarding                               |
| **Admin**       | **Edit only** the 4 plan slots (limits, price, SafePay id); **cannot add a 5th plan**                        |
| **Email**       | Custom-plan requests + billing notices via **Resend** — see `[EMAIL_RESEND_PLAN.md](./EMAIL_RESEND_PLAN.md)` |
| **Positioning** | Botpress-class agent SaaS — see `[AUDIT_BOTPRESS_VS_HAPY.md](../AUDIT_BOTPRESS_VS_HAPY.md)`                  |


---



# Part 0 — One-page summary



## What we are building

Aide charges customers for using the product — **Botpress-style pricing**: a fixed **4-column grid** after signup. Admin configures **each slot once** (limits + price + SafePay plan id); **no 5th plan**.


| Slot | `planType`  | Customer UX                                 | Checkout                               |
| ---- | ----------- | ------------------------------------------- | -------------------------------------- |
| 1    | **Basic** (`FREE`) | Rs 0 — activate instantly                   | No SafePay                             |
| 2    | **Popular** | Paid — **featured** badge                   | SafePay hosted checkout                |
| 3    | **Teams**   | Paid — higher limits / multi-workspace tier | SafePay hosted checkout                |
| 4    | **Custom**  | “Contact us” — **request form**             | No SafePay; admin email + in-app queue |


New users pick a plan after signup. **Popular** and **Teams** go to SafePay when `safepayPlanId` is set. **Only a verified SafePay webhook** unlocks paid access. **Custom** submits `CustomPlanRequest` → Resend email to admin → admin follows up manually. Entitlements come from the active `Subscription` plan.

**SafePay dashboard:** create **2 recurring plans** (Popular + Teams). Basic and Custom stay in Aide only.

## Implementation snapshot (Sep 1, 2026)

| Area | Status |
| ---- | ------ |
| **B0** Catalog + admin | ✅ Code + migrations + `npm run test:billing-b0` |
| **B1** Post-register gate | ✅ Plans → onboarding → dashboard; grandfather Basic ACTIVE |
| **B2** SafePay checkout + webhooks | ✅ Code + `BillingEvent`; **manual sandbox pay not verified in this environment** |
| **B3** Entitlements | ✅ Workspace/agent caps, PAST_DUE soft lock, past-due banner |
| **B3+** Conversation quota | ✅ Extra (not in original B3 doc): monthly billable convos, sidebar meter, 402 on chat |
| **B4** Portal + lifecycle | ✅ `/settings/billing`, `/billing/plans` change mode, cancel API, `pendingPlanId` upgrades, paid→Basic downgrade |
| **B5** Hardening | 🟡 `expireStalePendingCheckouts` + `npm run billing:expire-pending` + `test:billing-b5`; prod runbook / pen-test / Resend email **open** |

**Automated scripts:** `npm run test:billing` runs B0–B5 static/integration checks (B0 needs DB + dev server for HTTP subset).

**Before manual testing:** `npx prisma migrate deploy` · `npx prisma generate` · `node prisma/seed-billing.js` · set SafePay env vars in `.env` (see `.env.example`).

## What we are not building (this program)

- Stripe / Paddle / Lemon Squeezy  
- Unlimited / à-la-carte plan catalog (admin is locked to **4 slots**)  
- Per-seat team billing with invite flows (Teams tier = **higher caps**, not P3-TEAMS members yet)  
- Tax engine / PDF invoices / accounting export  
- Coupons, trials, usage metering (optional later — named in Appendix)  
- Card data on Aide servers (PCI: **never**)  
- Fake “Pay” buttons that mark ACTIVE without webhook



## Absolute security invariants (non-negotiable)

1. **Never trust the browser redirect alone** to activate a paid subscription.
2. **Webhook HMAC must verify** before any state change; fail closed (401/400).
3. **Idempotent webhooks** — same event id processed once.
4. **Checkout is server-side only** — client never invents price or `safepayPlanId`.
5. **Authorization on every billing mutation** — user can only act on own subscription; admin only via `requireAdmin`.
6. **Secrets never in client bundles** — API keys / webhook secrets server-only.
7. **Audit every money-adjacent transition** — PENDING → ACTIVE, cancel, past_due, plan change.
8. **ADMIN role bypasses paywall** — operators must not be locked out of `/admin`.
9. **No half-configured production keys** — checkout disabled if SafePay env incomplete.
10. **Logs must not contain** full PANs, raw webhook secrets, or full signed payloads in error trackers (truncate / redact).

---



# Part 1 — Current system (as of Sep 1, 2026)


| Area                | Today                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Auth                | Auth.js v5 JWT; credentials + Google; register → billing gate before product shell                        |
| Multi-tenancy       | User owns N Workspaces; plan caps on workspaces / agents / monthly conversations                          |
| Caps                | **Plan entitlements** when subscription unlocked; else `PlatformSettings` fallback                        |
| Gates               | Signups closed, maintenance, suspended user, embed kill, **billing unlock** (ACTIVE / PAST_DUE)         |
| Billing             | **SafePay B01** — `BillingPlan`, `Subscription`, `BillingEvent`, `CustomPlanRequest`; `@sfpy/node-sdk`    |
| Customer UI         | `/billing/plans`, `/billing/onboarding`, `/billing/success` \| `/canceled`, `/settings/billing`           |
| Admin UI            | `/admin/billing` (4-slot editor), `/admin/billing/requests`, subscription snippet on user inspect         |
| Quota UI            | Sidebar conversation meter; admin inspect quota; chat 402 when monthly limit hit                            |


**Implication:** Billing must insert a **gate after auth, before product shell**, without breaking ADMIN, suspended, or maintenance flows.

---



# Part 2 — Domain model



## 2.1 Entities



### `BillingPlan` (admin-configured catalog)


| Field                     | Type                                         | Notes                                                                                                                                                     |
| ------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | cuid                                         |                                                                                                                                                           |
| `slug`                    | string unique                                | Fixed: `free`, `popular`, `teams`, `custom` — seeded in B0                                                                                                |
| `name`                    | string                                       | Display (admin editable), e.g. “Free”, “Popular”, “Teams”, “Custom”                                                                                       |
| `description`             | string?                                      | Short                                                                                                                                                     |
| `planType`                | enum `FREE` | `POPULAR` | `TEAMS` | `CUSTOM` | **Unique** — exactly one row per type (see §2.1.1)                                                                                                        |
| `isPopular`               | bool                                         | When true **and** `planType = POPULAR`, show “Popular” badge on pricing card                                                                              |
| `priceMinor`              | int                                          | Integer money. **B0 decision:** store **whole PKR** as integer (e.g. `2999` = Rs 2999). `0` for Free. Custom type may show “Contact us” instead of price. |
| `currency`                | string                                       | Default `PKR`                                                                                                                                             |
| `interval`                | enum `MONTH` | `YEAR`                        | Start with `MONTH` unless product needs yearly                                                                                                            |
| `safepayPlanId`           | string?                                      | SafePay `plan_…`. Required for **POPULAR** and **TEAMS** paid checkout; **null** for Free and Custom                                                      |
| `maxWorkspaces`           | int                                          | `0` = unlimited (match existing PlatformSettings convention)                                                                                              |
| `maxAgentsPerWorkspace`   | int                                          | `0` = unlimited                                                                                                                                           |
| `featuresJson`            | Json                                         | Bullet list for UI only — **not** security boundary                                                                                                       |
| `sortOrder`               | int                                          | Ascending                                                                                                                                                 |
| `isActive`                | bool                                         | Inactive hidden from public catalog                                                                                                                       |
| `isDefault`               | bool                                         | At most one default (prefer Free)                                                                                                                         |
| `createdAt` / `updatedAt` | datetime                                     |                                                                                                                                                           |




#### 2.1.1 Plan types — fixed 4 slots (Botpress-style)


| `planType` | `safepayPlanId` | Pricing page              | Post-select action                               | Suggested seed limits                 |
| ---------- | --------------- | ------------------------- | ------------------------------------------------ | ------------------------------------- |
| `FREE`     | null            | **Free**                  | `POST /api/billing/subscribe` → ACTIVE           | 1 workspace, 2 agents                 |
| `POPULAR`  | required        | Price + **Popular** badge | `POST /api/billing/checkout` → SafePay           | 3 workspaces, 10 agents               |
| `TEAMS`    | required        | Price (no badge)          | `POST /api/billing/checkout` → SafePay           | 10 workspaces, 25 agents              |
| `CUSTOM`   | null            | **Contact us** CTA        | Request form → `CustomPlanRequest` + admin email | N/A (no entitlements until converted) |


**Hard rules (enforce in service + DB):**

- Catalog is **exactly 4 rows** — one per `planType`.  
- **Unique index** on `planType`.  
- Admin APIs: **PATCH only** per slot — **no POST create**, **no DELETE** (deactivate via `isActive` on a slot if ever needed; default all four active).  
- Attempt to insert 5th plan → **409** `billing_plan_cap_reached`.  
- Public UI: **4-column grid** (responsive stack on mobile) — same layout pattern as Botpress pricing.  
- `isPopular` only on `planType = POPULAR`.  
- `sortOrder` fixed: Free=1, Popular=2, Teams=3, Custom=4 (admin may not reorder types).

**Rules:**

- Public catalog: `isActive = true`, ordered by `sortOrder`.  
- Exactly one `isDefault` — must be `planType = FREE`.  
- Changing `priceMinor` / `safepayPlanId` does **not** rewrite historical subscriptions; upgrades use new checkout.  
- `planType = CUSTOM` never calls SafePay from the catalog; admin converts via manual assign (B5).



### `CustomPlanRequest` (sales lead + admin queue)


| Field                     | Type              | Notes                                                       |
| ------------------------- | ----------------- | ----------------------------------------------------------- |
| `id`                      | cuid              |                                                             |
| `userId`                  | FK → User         | Requester (must be authenticated post-register)             |
| `planId`                  | FK → BillingPlan? | Which Custom card they clicked (optional if generic CTA)    |
| `companyName`             | string?           |                                                             |
| `contactName`             | string?           | Default from User.name                                      |
| `contactEmail`            | string            | Default from User.email                                     |
| `phone`                   | string?           |                                                             |
| `estimatedSeats`          | int?              |                                                             |
| `useCase`                 | string?           | Short dropdown or tags (admin-configurable later)           |
| `message`                 | string            | Free-text context — **required**                            |
| `status`                  | enum              | `NEW` | `CONTACTED` | `APPROVED` | `REJECTED` | `CONVERTED` |
| `adminNotes`              | string?           | Internal only                                               |
| `handledByAdminId`        | FK?               |                                                             |
| `handledAt`               | datetime?         |                                                             |
| `emailSentAt`             | datetime?         | Resend delivery logged                                      |
| `createdAt` / `updatedAt` |                   |                                                             |


**Rules:**

- One user may have multiple requests over time; dedupe spam via rate limit (e.g. 3 / 24h per user).  
- On create: persist row → enqueue Resend to `BILLING_ADMIN_EMAIL` (or all ADMIN users) → set `emailSentAt` on success.  
- User sees confirmation: “We received your request; our team will email you.” — **no** ACTIVE subscription until admin converts (manual plan assign or paid checkout link).  
- Admin UI: `/admin/billing/requests` list + detail; status transitions audited.

See `[EMAIL_RESEND_PLAN.md](./EMAIL_RESEND_PLAN.md)` § EM2 for `custom_plan_request_admin` template.

### `Subscription` (per User)


| Field                      | Type             | Notes                                                      |
| -------------------------- | ---------------- | ---------------------------------------------------------- |
| `id`                       | cuid             |                                                            |
| `userId`                   | FK               | See concurrency rules below                                |
| `planId`                   | FK → BillingPlan |                                                            |
| `status`                   | enum             | `PENDING` | `ACTIVE` | `PAST_DUE` | `CANCELED` | `EXPIRED` |
| `safepaySubscriptionToken` | string?          | SafePay `sub_…`                                            |
| `safepayCustomerRef`       | string?          | If SafePay returns user/customer id                        |
| `checkoutReference`        | string unique    | **Our** id sent as SafePay `reference` — webhook join key  |
| `currentPeriodEnd`         | datetime?        | From webhook / poll                                        |
| `cancelAtPeriodEnd`        | bool             | Default false                                              |
| `canceledAt`               | datetime?        |                                                            |
| `activatedAt`              | datetime?        | First ACTIVE                                               |
| `lastPaymentAt`            | datetime?        |                                                            |
| `lastWebhookAt`            | datetime?        |                                                            |
| `createdAt` / `updatedAt`  |                  |                                                            |


**Concurrency model (money-safe):**

- A user may have **at most one** row in `{PENDING, ACTIVE, PAST_DUE}` at a time (partial unique index or transactional enforce).  
- `CANCELED` / `EXPIRED` retained for audit history (optional `SubscriptionHistory` later).  
- New checkout while `PENDING`: reuse same row or supersede with new `checkoutReference` in a transaction (document in B2).  
- New paid plan while `ACTIVE`: create **upgrade checkout session** without flipping ACTIVE until webhook confirms (see upgrades).



### `BillingEvent` (idempotency + forensic log)


| Field                        | Type                                            | Notes                                                              |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `id`                         | cuid                                            |                                                                    |
| `provider`                   | `SAFEPAY`                                       |                                                                    |
| `eventType`                  | string                                          | e.g. `subscription:created`                                        |
| `externalId`                 | string unique                                   | Provider delivery/event id — **idempotency key**                   |
| `checkoutReference`          | string?                                         |                                                                    |
| `userId`                     | string?                                         | Resolved after match                                               |
| `subscriptionId`             | string?                                         |                                                                    |
| `signatureValid`             | bool                                            |                                                                    |
| `processingStatus`           | `RECEIVED` | `PROCESSED` | `IGNORED` | `FAILED` |                                                                    |
| `errorMessage`               | string?                                         | Safe, no secrets                                                   |
| `payloadHash`                | string                                          | SHA-256 of raw body (not full payload in clear if large/sensitive) |
| `payloadRedacted`            | Json?                                           | Optional store of non-sensitive fields only                        |
| `receivedAt` / `processedAt` |                                                 |                                                                    |




### Optional later: `BillingCheckoutSession`

If PENDING subscription alone is not enough for upgrade flows, add an explicit session table in B2. Prefer starting with fields on `Subscription` + `checkoutReference`.

## 2.2 Status machine

```
                    ┌─────────────┐
         select free│             │
   register ───────►│   ACTIVE    │◄──── webhook subscription:created
         select paid│             │      + payment complete (paid)
                    └──────┬──────┘
                           │
         unpaid / fail     │ cancel (immediate or period end)
                           ▼
                    ┌─────────────┐
                    │  PAST_DUE   │──payment ok──► ACTIVE
                    └──────┬──────┘
                           │ grace exceeded / ended
                           ▼
                    ┌─────────────┐
         checkout   │  PENDING    │──cancel checkout / timeout──► CANCELED
         (paid) ───►│             │──webhook success────────────► ACTIVE
                    └─────────────┘
                           │
                           ▼
                       EXPIRED / CANCELED (terminal for that row)
```

**Product access matrix**


| Status                 | Product app (`/dashboard`, agents, …)    | Billing UI | Creates (workspace/agent) |
| ---------------------- | ---------------------------------------- | ---------- | ------------------------- |
| None (no row)          | ❌ redirect plans                         | ✅          | ❌                         |
| `PENDING`              | ❌ (success/waiting pages only)           | ✅          | ❌                         |
| `ACTIVE`               | ✅                                        | ✅          | Plan limits               |
| `PAST_DUE`             | ✅ read / limited (**soft lock** default) | ✅          | ❌ new creates             |
| `CANCELED` / `EXPIRED` | ❌ → plans                                | ✅          | ❌                         |
| `ADMIN` role           | ✅ always                                 | n/a        | PlatformSettings caps     |


**Default past-due policy (soft lock):** keep reading existing agents/inbox; block new billable creates; show banner. Hard lock (full app block) is a config flag later — do not flip without product decision.

## 2.3 Entitlements

```
getEntitlements(userId):
  if role === ADMIN → PlatformSettings caps (or unlimited ops)
  sub = current subscription
  if !sub || status not in (ACTIVE, PAST_DUE) → no product entitlements
  plan = sub.plan
  return {
    maxWorkspaces: plan.maxWorkspaces,
    maxAgentsPerWorkspace: plan.maxAgentsPerWorkspace,
    status: sub.status,
    planSlug: plan.slug,
  }
```

Wire into existing `createWorkspaceForUser` / agent create — replace or override global soft caps when subscription ACTIVE/PAST_DUE.

`featuresJson` is **display only**. Never gate security on a JSON bullet string.

---



# Part 3 — End-to-end flows



## 3.1 Email/password register (happy path)

```
1. POST /api/auth/register → User ACTIVE + default Workspace (unchanged)
2. Client signIn(credentials)
3. proxy / app layout: USER without unlockable subscription → /billing/plans
4a. Free plan → POST /api/billing/subscribe { planId }
      → server verifies plan.planType === FREE + safepayPlanId is null + isActive
      → Subscription ACTIVE (transaction)
      → Audit BILLING_ACTIVATED
      → redirect /dashboard
4b. Popular or Teams (paid) → POST /api/billing/checkout { planId }
      → server verifies plan.planType in (POPULAR, TEAMS) + safepayPlanId + SafePay env ready
      → Subscription PENDING + checkoutReference (uuid)
      → SafePay createSubscription URL (server)
      → return { url } → browser redirect (top-level)
4c. Custom plan → user fills request form on /billing/plans
      → POST /api/billing/custom-request { planId?, companyName, message, … }
      → CustomPlanRequest NEW + Resend email to admin (see EMAIL_RESEND_PLAN)
      → user stays on confirmation screen; no Subscription until admin converts
5. User pays on SafePay
6. Webhook subscription:created (+ payment complete) → ACTIVE
7. Redirect /billing/success → poll GET /api/billing/status → /dashboard
```



## 3.2 Google first-time signup

Same gate after JWT session exists. Do **not** create ACTIVE subscription in Google callback. First hit to protected route → `/billing/plans`.

## 3.3 Cancel on SafePay / abandon

- User returns `cancel_url` → `/billing/canceled` → still PENDING → can retry checkout.  
- Do not delete User.  
- Optional: PENDING older than N days → EXPIRED job (B5).



## 3.4 Upgrade / downgrade (Phase B4)

- **Upgrade (paid→higher paid):** new SafePay checkout with new plan id; keep old ACTIVE until webhook; then swap planId + token in transaction.  
- **Downgrade:** either period-end change (`cancelAtPeriodEnd` + schedule) or immediate with SafePay rules — **confirm with SafePay support before coding**. Until confirmed: only “cancel + resubscribe”.  
- **Paid→Free:** cancel SafePay sub; on `subscription:ended` set plan to Free ACTIVE or CANCELED→must pick Free again.



## 3.5 Admin

- **Edit** the 4 plan slots at `/admin/billing` — limits, display name, price, `safepayPlanId`, `featuresJson`, `isActive`. **No “Add plan” button.**  
- Custom requests at `/admin/billing/requests` — view, status, notes, link to user.  
- User inspect: subscription status, plan, last payment, checkoutReference (support).  
- Cannot “force ACTIVE” without audit + reason field (break-glass) — optional B5; default **no silent force**.



## 3.6 Custom plan request (happy path)

```
1. User on /billing/plans clicks Custom plan card → sheet/dialog form
2. POST /api/billing/custom-request (auth required, zod validate, rate limit)
3. Insert CustomPlanRequest (status NEW)
4. sendEmail({ template: 'custom_plan_request_admin', to: BILLING_ADMIN_EMAIL, … })
5. Return { ok: true, requestId }
6. UI: success state — “Team will contact you at {email}”
7. Admin receives email with deep link to /admin/billing/requests/{id}
8. Admin marks CONTACTED → APPROVED → manually creates paid plan or sends checkout link (B5)
```

**Gate behavior:** User without ACTIVE subscription remains on billing shell; Custom request does **not** unlock dashboard until admin converts or user picks Free / Popular / Teams.

---



# Part 4 — SafePay integration contract



## 4.1 SDK / APIs

- Package: `@sfpy/node-sdk` (official).  
- Flow: auth/passport token → `checkout.createSubscription` / `createSubscriptionWithToken` with:
  - `planId` = `BillingPlan.safepayPlanId` (**from DB, never client**)
  - `reference` = our `checkoutReference`
  - `redirectUrl` / `cancelUrl` = Aide absolute URLs (`AUTH_URL` / `NEXT_PUBLIC_APP_URL`)
- Manage: cancel / pause / resume via SDK when B4 opens.



## 4.2 Webhooks (authoritative)

Dashboard / aggregator endpoint → `POST /api/webhooks/safepay`

**Subscribe at minimum (SafePay subscription set):**


| Event                           | Action                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `subscription:created`          | Match `reference` → set token; do **not** alone grant ACTIVE for paid if payment incomplete |
| `subscription_payment:complete` | ACTIVE + `lastPaymentAt` + period end if present                                            |
| `subscription_payment:failed`   | Stay PENDING or → PAST_DUE if was ACTIVE                                                    |
| `subscription:unpaid`           | PAST_DUE + audit                                                                            |
| `subscription:ended`            | CANCELED/EXPIRED + revoke product access                                                    |


Also verify payment events if SafePay links them; **ignore unknown types** (log + `IGNORED`).

**Paid ACTIVE rule:** Prefer requiring `subscription_payment:complete` (or equivalent) before ACTIVE. If sandbox only fires `subscription:created` with paid instrument already attached, document exception in B2 spike notes — never guess in production.

### Signature verification (mandatory)

- Read **raw body**.  
- Verify `X-SFPY-SIGNATURE` (or current SafePay header names) with `X-SFPY-TIMESTAMP` + webhook secret (HMAC-SHA256 per SafePay docs).  
- Reject if timestamp skew > allowed window (e.g. 5 minutes) — replay mitigation.  
- **Constant-time compare** for signatures.  
- On failure: **do not** update Subscription; return 401; record `BillingEvent` with `signatureValid=false` if possible without trusting body.



### Idempotency

1. Compute `externalId` from provider delivery id / event id.
2. Insert `BillingEvent` with unique constraint; on conflict → return 200 (already processed).
3. Process in transaction with subscription row lock.



### Ordering / races

- Payment complete before created: upsert by `checkoutReference`; allow either order.  
- Duplicate created: no-op if already ACTIVE with same token.  
- Webhook for unknown reference: `IGNORED` + alert log (possible attacker or misconfig).  
- Webhook user mismatch: never attach to different `userId` than checkout owner.



## 4.3 Redirect URLs (non-authoritative)


| URL                      | Behavior                                                                    |
| ------------------------ | --------------------------------------------------------------------------- |
| `/billing/success?ref=…` | Show “Confirming payment…”; poll status; **never** set ACTIVE in this route |
| `/billing/canceled`      | Message + link retry                                                        |
| `/billing/plans`         | Catalog                                                                     |


Query `ref` must belong to session user or ignore.

## 4.4 Environment

```bash
# Server only — never NEXT_PUBLIC_
SAFEPAY_ENVIRONMENT=sandbox   # development | sandbox | production
SAFEPAY_API_KEY=...
SAFEPAY_WEBHOOK_SECRET=...
# If required by aggregator webhook API:
SAFEPAY_AGGREGATOR_ID=...

# Existing
AUTH_URL=https://...          # webhook + redirect base
NEXT_PUBLIC_APP_URL=https://...
```

**Readiness check:** `isSafepayConfigured()` — all required vars non-empty. If false: paid checkout returns 503 “Payments unavailable”; Free still works.

---



# Part 5 — API surface



## Public / authenticated


| Method | Path                     | Auth           | Purpose                                    |
| ------ | ------------------------ | -------------- | ------------------------------------------ |
| GET    | `/api/billing/plans`     | public or auth | Active plans (no secrets; no Safepay keys) |
| GET    | `/api/billing/status`    | USER           | Own subscription + entitlements            |
| POST   | `/api/billing/subscribe` | USER           | Free plan activate only                    |
| POST   | `/api/billing/checkout`  | USER           | Start paid SafePay checkout                |
| POST   | `/api/billing/cancel`    | USER           | Cancel own sub (B4)                        |
| POST   | `/api/webhooks/safepay`  | signature      | Inbound SafePay                            |




## Admin


| Method       | Path                               | Auth  | Purpose                          |
| ------------ | ---------------------------------- | ----- | -------------------------------- |
| GET/POST     | `/api/admin/billing/plans`         | ADMIN | List / create                    |
| PATCH/DELETE | `/api/admin/billing/plans/[id]`    | ADMIN | Update / deactivate              |
| GET          | `/api/admin/billing/subscriptions` | ADMIN | Filter past_due etc.             |
| GET          | `/api/admin/users/[id]`            | ADMIN | Include billing summary (extend) |


**Rate limits:** checkout / subscribe strict per user + IP (reuse `lib/rate-limit`). Webhook: generous but bounded; signature failure IP throttle.

---



# Part 6 — UI surfaces


| Surface          | Route                                   | Notes                                   |
| ---------------- | --------------------------------------- | --------------------------------------- |
| Plan picker      | `/billing/plans`                        | Post-auth; 3 cards; no Intercom clutter |
| Success / cancel | `/billing/success`, `/billing/canceled` | Minimal                                 |
| Customer billing | `/settings/billing`                     | B4                                      |
| Admin plans      | `/admin/billing`                        | B0                                      |
| Banner           | App shell                               | PAST_DUE warning                        |


**Gate implementation:**

- Extend `proxy.js`: USER on protected prefixes without `billingUnlocked` → redirect `/billing/plans`.  
- Allowlist: `/billing/*`, `/api/billing/*`, auth routes, public marketing `/`.  
- JWT claim or DB check: prefer **DB status on each request** for money gates (JWT can lag); cache briefly if needed with care.  
- `app/(app)/layout.jsx`: secondary check + banner.

---



# Part 7 — Security deep dive



## 7.1 Threat model (STRIDE-style)


| Threat                       | Example                                  | Mitigation                                                        |
| ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Spoofed webhook              | Attacker POSTs “payment complete”        | HMAC + timestamp; fail closed                                     |
| Replay webhook               | Reuse old valid payload                  | Idempotency key + timestamp window                                |
| Price tampering              | Client sends `price: 0` or wrong planId  | Server loads plan by id; ignore client price                      |
| Plan id swap                 | Client sends Free id with paid intent    | `subscribe` only if `safepayPlanId == null`; checkout only if set |
| Reference guessing           | Guess another user’s `checkoutReference` | Unpredictable UUID; bind to userId; webhook cannot reassign user  |
| Open redirect                | `redirectUrl` from client                | Server builds URLs from allowlisted app origin only               |
| CSRF on checkout             | Trick user into POST checkout            | Same-site cookies + auth session; optional CSRF token             |
| Admin XSS in plan name       | Script in plan name                      | React text escape; sanitize admin inputs length                   |
| Privilege escalation         | USER hits admin billing API              | `requireAdmin`                                                    |
| Lockout                      | Admin must pay                           | ADMIN bypass                                                      |
| Secret leak                  | Key in `NEXT_PUBLIC_` or logs            | Server-only env; redacted logs                                    |
| Double spend / double grant  | Two checkouts                            | One open PENDING; transactional activate                          |
| TOCTOU                       | Plan deactivated mid-checkout            | Re-read plan at checkout; webhook validates plan still maps       |
| Subscription to deleted plan | Plan soft-deleted                        | Deactivate only (`isActive=false`); FK remains                    |
| Session fixation after pay   | Old session                              | Existing Auth.js session fine; regenerate optional B5             |




## 7.2 Authorization matrix


| Actor   | List plans | Checkout   | Activate free | Cancel own | Webhook | Admin CRUD |
| ------- | ---------- | ---------- | ------------- | ---------- | ------- | ---------- |
| Anon    | ✅ public   | ❌          | ❌             | ❌          | ❌       | ❌          |
| USER    | ✅          | ✅ own      | ✅ own         | ✅ own      | ❌       | ❌          |
| ADMIN   | ✅          | n/a bypass | n/a           | n/a        | ❌       | ✅          |
| SafePay | ❌          | ❌          | ❌             | ❌          | ✅ sig   | ❌          |




## 7.3 Data handling

- Store **tokens / references**, not card numbers.  
- Webhook raw body: verify then hash; avoid storing full PAN-bearing payloads.  
- Support tooling: show last4 only if SafePay provides it (optional).  
- Export/delete user (GDPR-ish): cancel sub at provider; retain BillingEvent minimally for fraud (legal hold policy — document).



## 7.4 Secure coding checklist (every PR)

- [ ] No ACTIVE without webhook (paid) or free-plan server path  
- [ ] Signature verified before parse-driven side effects  
- [ ] Unique constraint on billing event external id  
- [ ] Transactions around status transitions  
- [ ] Rate limits on checkout  
- [ ] Tests for forged webhook, replay, cross-user ref  
- [ ] `.env.example` documents vars without real secrets  

---



# Part 8 — Edge cases (money + product)

> Each row: **Expected** is the contract. Test before closing the phase.



## E1 — Signup & gate


| ID    | Scenario                             | Expected                                                                                                 |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| E1.01 | New email register                   | Lands on `/billing/plans`, not dashboard                                                                 |
| E1.02 | Google first login                   | Same gate                                                                                                |
| E1.03 | Google returning user ACTIVE         | Dashboard                                                                                                |
| E1.04 | ADMIN login                          | `/admin`, no plan gate                                                                                   |
| E1.05 | Suspended USER                       | Suspended flow wins over billing                                                                         |
| E1.06 | Maintenance on                       | Maintenance screen for USER; billing inaccessible                                                        |
| E1.07 | Signups closed                       | Cannot register; no orphan PENDING                                                                       |
| E1.08 | Existing users at billing launch     | Migration: grant default Free ACTIVE (recommended) **or** force picker — **product choice locked in B1** |
| E1.09 | Deep link `/agents` while PENDING    | Redirect plans                                                                                           |
| E1.10 | API `POST /api/agents` while PENDING | 402/403 billing required (not 500)                                                                       |




## E2 — Plans & admin config


| ID    | Scenario                         | Expected                                                                                                        |
| ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| E2.01 | 0 active plans                   | Public empty state; checkout disabled; alert admin                                                              |
| E2.02 | >3 active plans                  | UI shows all active **or** first 3 by sort — pick one policy in B0 (recommend show all active, soft-warn admin) |
| E2.03 | Deactivate plan with subscribers | Allowed; existing subs keep planId; new checkouts blocked                                                       |
| E2.04 | Delete plan with FK subs         | **Forbidden** — soft deactivate only                                                                            |
| E2.05 | Two defaults                     | Service rejects / last-write clears others                                                                      |
| E2.06 | Free plan with safepayPlanId set | Invalid config — reject save                                                                                    |
| E2.07 | Paid plan without safepayPlanId  | Reject save **or** save but checkout 503 — prefer reject                                                        |
| E2.08 | Edit price after subscribers     | Display for new buyers only; old sub unchanged                                                                  |
| E2.09 | Change safepayPlanId             | Old PENDING checkouts may fail webhook plan match — expire PENDING                                              |




## E3 — Checkout


| ID    | Scenario                                        | Expected                                                   |
| ----- | ----------------------------------------------- | ---------------------------------------------------------- |
| E3.01 | Free subscribe                                  | ACTIVE immediately; no SafePay call                        |
| E3.02 | Paid checkout                                   | PENDING + redirect URL                                     |
| E3.03 | SafePay misconfigured                           | 503; no PENDING orphan without URL (or PENDING with retry) |
| E3.04 | Double-click checkout                           | Idempotent — one reference / one URL                       |
| E3.05 | Checkout while ACTIVE                           | Reject or upgrade path (B4)                                |
| E3.06 | Checkout while PENDING                          | Replace reference **or** return existing URL — document    |
| E3.07 | User A uses User B’s ref on success page        | No status leak; 404                                        |
| E3.08 | Client sends another user’s plan + forged price | Ignored; server plan only                                  |
| E3.09 | CSRF cross-site POST checkout                   | Blocked by session rules                                   |
| E3.10 | cancel_url hit                                  | Still PENDING; can retry                                   |




## E4 — Webhooks


| ID    | Scenario                  | Expected                                |
| ----- | ------------------------- | --------------------------------------- |
| E4.01 | Valid created + pay       | ACTIVE; audit                           |
| E4.02 | Invalid signature         | 401; no state change                    |
| E4.03 | Replay same event id      | 200; no double grant                    |
| E4.04 | Stale timestamp           | Reject                                  |
| E4.05 | Unknown reference         | IGNORED; no user unlocked               |
| E4.06 | Event order swapped       | Still ACTIVE end state                  |
| E4.07 | payment failed on PENDING | Stay PENDING or mark failed; not ACTIVE |
| E4.08 | unpaid on ACTIVE          | PAST_DUE; creates blocked               |
| E4.09 | ended                     | Access revoked per matrix               |
| E4.10 | Webhook floods            | Rate limit; still verify sig first      |
| E4.11 | Body too large            | Reject                                  |
| E4.12 | Partial process crash     | Retry safe via idempotency              |




## E5 — Entitlements


| ID    | Scenario                | Expected                                      |
| ----- | ----------------------- | --------------------------------------------- |
| E5.01 | At workspace limit      | 400 clear message                             |
| E5.02 | Unlimited `0`           | No cap                                        |
| E5.03 | PAST_DUE create agent   | Blocked                                       |
| E5.04 | PAST_DUE read inbox     | Allowed (soft lock)                           |
| E5.05 | Upgrade increases limit | New creates succeed                           |
| E5.06 | Downgrade below usage   | No auto-delete; block new; banner “over plan” |




## E6 — Lifecycle & support


| ID    | Scenario                               | Expected                                                  |
| ----- | -------------------------------------- | --------------------------------------------------------- |
| E6.01 | User cancels                           | Provider cancel + local state via webhook                 |
| E6.02 | Cancel API success but webhook delay   | Show “cancel pending”; poll                               |
| E6.03 | Chargeback / reverse (if event exists) | PAST_DUE or revoke; audit                                 |
| E6.04 | User deletes account request           | Cancel provider first                                     |
| E6.05 | Support: wrong plan                    | Admin cannot silent ACTIVE without audit break-glass (B5) |
| E6.06 | Clock skew period end                  | Prefer provider timestamps                                |




## E7 — Embed / public product


| ID    | Scenario                           | Expected                                                                                                                                    |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| E7.01 | Owner PAST_DUE; embed already live | **Policy:** keep embed serving (customer-facing) until hard lock — default **keep live** to avoid punishing end visitors; banner owner only |
| E7.02 | Owner CANCELED                     | Embed kill optional — default soft: embed stays until grace; document                                                                       |
| E7.03 | globalEmbedKill                    | Still wins                                                                                                                                  |




## E8 — Concurrency & data integrity


| ID    | Scenario                                     | Expected                                                   |
| ----- | -------------------------------------------- | ---------------------------------------------------------- |
| E8.01 | Two tabs free-subscribe                      | One ACTIVE row; second 409/ok no-op                        |
| E8.02 | Tab A checkout Popular, Tab B checkout Teams | One PENDING; reject second with “finish or cancel current” |
| E8.03 | Webhook + user refresh simultaneous          | Transaction / row lock; single ACTIVE                      |
| E8.04 | DB unique on `checkoutReference`             | Collision impossible for UUID v4; still handle 500 safely  |
| E8.05 | Plan deleted mid-flight (admin mistake)      | Soft-deactivate only; checkout fails closed                |




## E9 — Ops & environment


| ID    | Scenario                        | Expected                                                                       |
| ----- | ------------------------------- | ------------------------------------------------------------------------------ |
| E9.01 | Sandbox keys on production host | Refuse start or hard warning — env `SAFEPAY_ENVIRONMENT` must match deployment |
| E9.02 | Webhook URL localhost           | Document ngrok; production must be HTTPS public                                |
| E9.03 | AUTH_URL mismatch redirects     | Checkout builder uses single canonical origin                                  |
| E9.04 | Rotate webhook secret           | Dual-secret window optional; else brief downtime + update env                  |
| E9.05 | SafePay outage                  | Checkout 503; Free still works; clear error                                    |


---



# Part 9 — Phased delivery (test gates)



## Phase B0 — Catalog & admin (no SafePay, no gate)

**Build**

- Prisma: `BillingPlan` (+ `planType` unique, `isPopular`), `CustomPlanRequest`; enums; migration  
- Seed **exactly 4** plans: Free (default), Popular, Teams, Custom — idempotent upsert by `planType`  
- Admin UI `/admin/billing` — **4-slot editor** (no create) + `/admin/billing/requests` + APIs  
- `GET /api/billing/plans` — always returns 4 slots (inactive hidden from public only)  
- `POST /api/billing/custom-request` (stub email if Resend not ready — log only in dev)  
- Audit on plan create/update and request status change

**Depends on:** EM0 Resend wiring recommended before custom-request goes to staging (see `[EMAIL_RESEND_PLAN.md](./EMAIL_RESEND_PLAN.md)`).

**Security focus:** admin authz; no client trust; input validation (zod); no secrets; rate limit custom requests  

**Test gate**

- [x] Admin can edit each of 4 slots; **409** on create 5th plan (code)  
- [x] Public pricing shows 4-column grid; Popular badge on Popular only  
- [x] Custom form creates request + admin list entry  
- [x] Non-admin 404/401 on admin APIs  
- [x] Seed deterministic (`prisma/seed-billing.js`)  
- [x] `npm run test:billing-b0` — **manual:** run against live DB + dev server

**Exit:** ✅ Plans + custom request configurable end-to-end without affecting register.

---



## Phase B1 — Post-register gate (Free only real)

**Build**

- `Subscription` model  
- `/billing/plans` UI  
- Free activate API  
- proxy + layout gate  
- `/api/auth/me` includes `billing`  
- Migration strategy for existing users (**lock decision:** auto Free ACTIVE recommended)

**Security focus:** gate bypass attempts; ADMIN bypass; suspended/maintenance precedence  

**Test gate**

- [x] New user cannot hit `/dashboard` HTML or agents API (layout + `requireProductAccess`)  
- [x] Basic activate → onboarding → dashboard  
- [x] ADMIN unaffected  
- [ ] E1.xx subset automated — **manual** auth gate script: `npm run test:auth-gates` if configured

**Exit:** ✅ Basic instant; paid buttons show “Payments unavailable” until SafePay env complete (`paymentsAvailable` from plans API).

---



## Phase B2 — SafePay sandbox + webhooks

**Build**

- Env + `isSafepayConfigured`  
- Checkout API + SDK  
- Webhook route + signature + BillingEvent  
- Success/cancel pages + status poll  
- Sandbox runbook (ngrok for webhooks)

**Security focus:** invariants 1–3, 6, 9; forged/replay tests  

**Test gate**

- [ ] Sandbox pay → webhook → ACTIVE — **manual** (needs SafePay sandbox keys + ngrok webhook URL)  
- [ ] Forged webhook rejected — **manual** or fixture test  
- [ ] Replay no double ACTIVE — **manual**  
- [x] Cancel URL leaves checkout recoverable (`/billing/canceled`)  
- [x] Success page polls status; does not self-activate without webhook  
- [x] `npm run test:billing-b2` static checks

**Exit:** 🟡 Money path coded; **sandbox E2E not signed off in repo**.

---



## Phase B3 — Entitlements

**Build**

- `getEntitlements`  
- Wire workspace/agent creates  
- PAST_DUE soft lock  
- Owner banner

**Test gate**

- [x] Limits enforced (workspace / agent create)  
- [x] Over-limit messaging (402 + UI)  
- [x] PAST_DUE create blocked; read ok  
- [x] Conversation monthly quota (extra): `npm run test:billing-conversations`  
- [x] `npm run test:billing-b3`

**Exit:** ✅ Caps follow plan (+ conversation quota).

---



## Phase B4 — Customer portal & lifecycle

**Build**

- `/settings/billing`  
- Cancel / change plan (`/billing/plans`, `pendingPlanId` for paid upgrades without early entitlement swap)  
- Admin subscription on user inspect (not a separate subscription list page)  
- SafePay cancel API  
- Paid → Basic downgrade via subscribe + SafePay cancel  
- `subscription:ended` webhook → revert to Basic ACTIVE

**Test gate**

- [ ] Cancel → ended webhook → Basic ACTIVE — **manual**  
- [x] Resubscribe / upgrade checkout path (code)  
- [x] Admin sees subscription status on user detail  
- [x] `npm run test:billing-b4`

**Exit:** ✅ Customer portal + plan changes in code; webhook cancel flow **manual**.



## Phase B5 — Hardening & production

**Build**

- Production SafePay keys runbook — **open** (env in `.env.example` only)  
- PENDING expiry job — ✅ `expireStalePendingCheckouts` + `npm run billing:expire-pending`  
- Redacted logging — ✅ webhook `payloadRedacted` on `BillingEvent`  
- Full `test:billing` — ✅ B0–B5 scripts wired in `package.json`  
- Docs: `.env.example` — ✅; README billing section — **open**  
- Optional break-glass activate with audit — **not built**  
- Checkout rate limit — ✅ on checkout + cancel APIs

**Test gate**

- [ ] Pen-test checklist signed — **manual**  
- [ ] CI script green with sandbox secrets — **open**  
- [ ] Incident runbook — **open**  
- [x] `npm run test:billing-b5`

**Exit:** 🟡 Not production-ready until sandbox E2E + runbooks done.

---



# Part 10 — Defaults to lock in B0/B1 kickoff


| Question             | Recommendation                                                         | Status                |
| -------------------- | ---------------------------------------------------------------------- | --------------------- |
| Plan types           | **Basic / Popular / Teams / Custom** — **exactly 4**, no more (`FREE` enum) | **Locked**            |
| Display name         | **Basic** for free tier (not “Free”)                                     | **Locked (Sep 2026)** |
| Botpress alignment   | Fixed pricing grid + agent SaaS tiers                                  | **Locked**            |
| Popular badge        | On Popular slot only (`isPopular`)                                     | **Locked**            |
| Custom unlock        | **No dashboard** until admin converts or user picks Basic/Popular/Teams | **Implemented**       |
| Currency             | **PKR** monthly                                                        | **Implemented**       |
| Existing users       | **Auto Basic ACTIVE** (grandfather pre–2026-09-01)                     | **Implemented**       |
| Past due             | **Soft lock** (read ok, no creates)                                    | **Implemented**       |
| Embed when PAST_DUE  | **Keep serving**                                                       | **Implemented** (no embed block) |
| Price integer unit   | Whole PKR in `priceMinor`                                              | **Implemented**       |
| Max plans            | **Hard cap 4** — unique `planType`                                     | **Locked**            |
| SafePay plans        | **2** dashboard plans (Popular + Teams)                                | **Pending your SafePay dashboard setup** |
| Paid ACTIVE trigger  | Require `subscription_payment:complete`                                | **Implemented in code** |
| Custom request email | `BILLING_ADMIN_EMAIL` + Resend                                         | **Stub** (logs only; see EMAIL_RESEND_PLAN) |


Update this table when decisions are made; do not leave ambiguous in code comments only.

---



# Part 11 — File / module map (expected)

```
prisma/schema.prisma          # BillingPlan, Subscription (+ pendingPlanId), BillingEvent, CustomPlanRequest
lib/billing/
  plans.service.js
  subscription.service.js
  custom-request.service.js
  entitlements.service.js
  conversation-usage.service.js   # monthly billable conversation quota (extra)
  plan-labels.js                  # Basic display name helpers
  checkout.service.js
  webhook.service.js
  safepay-client.js
  constants.js
  access.js
  app-url.js
app/api/billing/...             # plans, subscribe, checkout, cancel, status, custom-request
app/api/webhooks/safepay/route.js
app/api/admin/billing/...
app/(billing)/billing/plans|onboarding|success|canceled/
app/(app)/settings/billing/page.jsx
components/billing/             # BillingPlanPicker, BillingSettings, quota UI, …
components/admin/AdminBilling.jsx
components/admin/AdminCustomPlanRequests.jsx
scripts/test-billing-b0.mjs … test-billing-b5.mjs
scripts/test-billing-conversation-quota.mjs
scripts/billing-expire-pending.mjs
prisma/seed-billing.js
```

Follow existing patterns: `jsonError` / `jsonOk`, `requireAuth` / `requireAdmin`, `safeLogError`, audit events, zod validations.

---



# Part 12 — Observability & incidents


| Signal                                | Where                                        |
| ------------------------------------- | -------------------------------------------- |
| Checkout started                      | Audit + structured log (userId, planId, ref) |
| Webhook received / processed / failed | BillingEvent + log                           |
| Signature failures spike              | Alert (ops) — possible attack                |
| PENDING > 24h count                   | Admin metric                                 |
| SafePay API errors                    | safeLogError; no key material                |


**Incident: webhook secret leaked** — rotate at SafePay; update env; invalidate old; audit.  
**Incident: API key leaked** — rotate; disable checkout until done.  
**Incident: false ACTIVE** — admin revoke + SafePay cancel; audit.

---



# Part 13 — Testing strategy


| Layer       | What                                                       |
| ----------- | ---------------------------------------------------------- |
| Unit        | Signature verify, status transitions, entitlements         |
| Integration | APIs with test DB; webhook fixtures with valid/invalid sig |
| Script      | `npm run test:billing-b*` mirroring `test:f14` style       |
| Manual      | Sandbox card pay once per B2/B5                            |
| Never       | Production keys in CI logs                                 |


Fixture rule: store **sample signed payloads** generated in sandbox; or mock verify in unit tests and one live sandbox smoke locally.

---



# Part 14 — Open questions (resolve before/during B0)

1. Confirm default Free plan limits (workspaces / agents).
2. Confirm PKR and interval.
3. Confirm existing-user grandfathering.
4. Confirm `BILLING_ADMIN_EMAIL` for custom requests (or broadcast to all ADMIN).
5. SafePay: exact webhook header names + subscription payload field for `reference` (validate against current dashboard docs in B2 spike).
6. SafePay: is `subscription:created` sufficient for ACTIVE or must wait for `subscription_payment:complete`? (**Prefer require payment complete for paid plans.**)
7. Upgrade proration support in SafePay — if none, cancel+resubscribe only.
8. Custom → paid conversion: manual admin assign only in B0–B4, or self-serve checkout link in B5?

---



# Part 15 — Progress checklist



### Decisions

- [x] Plan types: Basic (`FREE`) / Popular / Teams / Custom (**max 4**)  
- [x] Botpress-style fixed pricing grid  
- [x] Currency / interval (PKR / MONTH)  
- [x] Existing user migration (grandfather Basic ACTIVE)  
- [x] Past-due soft lock + embed keeps serving  
- [ ] Custom request admin email (Resend) — stub only  



### Phases

- [x] B0 Catalog + admin  
- [x] B1 Gate + Basic activate  
- [x] B2 SafePay + webhooks (code; sandbox E2E manual)  
- [x] B3 Entitlements (+ conversation quota extra)  
- [x] B4 Portal + lifecycle (code; cancel webhook manual)  
- [ ] B5 Hardening + prod (partial)  



### Security sign-off (before prod)

- [ ] Invariants 1–10 reviewed  
- [ ] Forged/replay webhook tests green (manual)  
- [ ] IDOR checkout ref tests green (manual)  
- [x] Secrets only server-side (code review)  
- [ ] Runbooks written  

---

# Part 16 — Manual testing checklist (your turn)

Run automated first:

```bash
npx prisma migrate deploy
npx prisma generate
node prisma/seed-billing.js
npm run test:billing
npm run test:billing-conversations
```

### A — Signup & Basic (no SafePay)

1. Register new user → should land on `/billing/plans` (not dashboard).  
2. Pick **Basic** → `/billing/onboarding` → complete → dashboard.  
3. Sidebar bottom: conversation meter shows Basic limits (e.g. 0/100).  
4. **Settings → Billing** and **Plan & billing** in sidebar → `/billing/plans` change mode.

### B — Admin catalog

1. `/admin/billing` — edit Popular price / limits; set `safepayPlanId` when you have SafePay plan ids.  
2. `/admin/billing/requests` — submit Custom form as user; approve/update in admin.

### C — Entitlements

1. On Basic: create workspaces/agents until limit → expect 402 + message.  
2. (Optional) Lower `maxConversationsPerMonth` in admin, send chats until 402 `conversation_limit_reached`.

### D — SafePay sandbox (needs env + ngrok)

Set in `.env`: `SAFEPAY_ENVIRONMENT`, `SAFEPAY_API_KEY`, `SAFEPAY_WEBHOOK_SECRET`, `SAFEPAY_V1_SECRET`, `AUTH_URL` / `NEXT_PUBLIC_APP_URL`.

1. Admin: Popular + Teams `safepayPlanId` filled.  
2. User: **Upgrade** on Popular → SafePay hosted checkout → pay test card.  
3. Webhook `POST /api/webhooks/safepay` must hit your public URL → subscription **ACTIVE**.  
4. `/billing/success?ref=…` polls until ACTIVE → dashboard.  
5. **Cancel** on Settings → Billing; confirm SafePay cancel; `subscription:ended` → back to **Basic ACTIVE**.  
6. Negative: POST forged webhook → **401**; replay same event id → no double charge state.

### E — Plan changes

1. Basic → Popular (paid checkout).  
2. Popular → Teams (upgrade checkout; `pendingPlanId` until webhook).  
3. Paid → **Switch to Basic** on plans page.  
4. Abandon checkout → `/billing/canceled`; user keeps current plan.

### F — Housekeeping

```bash
npm run billing:expire-pending
```

Confirm stale `PENDING` rows expire after policy (7 days default).

**Not in scope yet:** Resend email for custom requests, break-glass admin activate, dedicated admin subscription list page, production runbook in README.

---



## O01 / MCP sync (Aug 31, 2026)


| Topic                | Implication for B01                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Orchestrator shipped | Checkout / webhook / entitlement code stays outside `lib/orchestrator/`                                         |
| M01 MCP              | Optional plan limit `maxMcpServers` lands in **B3 entitlements** (see MCP plan M5) — not a reason to reopen O01 |
| Email                | Custom-plan notify still via E01 / Resend                                                                       |


---



# Appendix A — Later (named, not scheduled)

- Trials / coupons  
- Yearly discount  
- Usage metering (messages / AI tokens)  
- Invoice PDF  
- Multi-seat / workspace billing (after P3-TEAMS)  
- Hard lock past-due flag in PlatformSettings

---



# Appendix C — Botpress-style tier mapping (Aide)

Reference: `[AUDIT_BOTPRESS_VS_HAPY.md](../AUDIT_BOTPRESS_VS_HAPY.md)`. Botpress sells **usage-oriented, no per-seat** agent tiers; Aide mirrors with **4 fixed slots** and workspace/agent caps.


| Aide slot   | Botpress analog    | SafePay        | Admin configures         |
| ----------- | ------------------ | -------------- | ------------------------ |
| **Basic** (`FREE`) | Hobby / trial      | No             | Limits, features bullets |
| **Popular** | Growth (featured)  | Yes — `plan_…` | Price, limits, badge     |
| **Teams**   | Team / scale tier  | Yes — `plan_…` | Price, higher limits     |
| **Custom**  | Enterprise / sales | No             | Request form copy only   |




### Suggested seed copy (editable in admin)

**Popular** — SafePay description:

```
Aide Popular — for growing businesses. AI agents on your site, knowledge base, embed widget, human desk handoff, HTTP actions, and analytics. Billed monthly in PKR.
```

**Teams** — SafePay description:

```
Aide Teams — for teams running multiple brands or high-volume support. Everything in Popular, plus higher workspace and agent limits. Billed monthly in PKR.
```

**Teams** — `featuresJson` starter bullets:

```json
[
  "Up to 10 workspaces",
  "Up to 25 AI agents per workspace",
  "Everything in Popular",
  "Priority support",
  "Higher action & MCP limits (future)"
]
```

---



# Appendix B — Mapping from old P3-BILLING


| Old (Stripe sketch)       | New (this doc)                       |
| ------------------------- | ------------------------------------ |
| Stripe Customer Portal    | `/settings/billing` + SafePay hosted |
| Stripe webhooks           | `POST /api/webhooks/safepay`         |
| Plan on User or Workspace | **User**                             |
| Fake paywalls             | Explicitly forbidden                 |


---



## Related


| Doc                                                                    | Role                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `[AUDIT_BOTPRESS_VS_HAPY.md](../AUDIT_BOTPRESS_VS_HAPY.md)`            | Product positioning — 4-tier agent SaaS                           |
| `[EMAIL_RESEND_PLAN.md](./EMAIL_RESEND_PLAN.md)`                       | Resend transactional email — custom plan notify, auth, onboarding |
| `[POST_MVP_BACKLOG_PLAN.md](../POST_MVP_BACKLOG_PLAN.md)` § P3-BILLING | Historical Stripe sketch — superseded by SafePay here             |
| `[OPEN_SEQUENCE.md](../OPEN_SEQUENCE.md)`                              | Add B01 when execution starts                                     |
| Admin Safety / PlatformSettings                                        | Caps predecessor                                                  |
| Auth register + `proxy.js`                                             | Gate insertion points                                             |


---

*Document owner: engineering. Money path changes require security review of webhook + entitlement PRs.*