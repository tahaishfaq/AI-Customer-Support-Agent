# B01-C — In-AIDE Safepay Atoms + Card-on-File (COF) migration

**Status:** 🟢 Hybrid Phase 1 shipping (Atoms first pay; COF renew still blocked)  
**Parent:** [`BILLING_SAFEPAY.md`](./BILLING_SAFEPAY.md) (B0–B5 hosted `/subscribe` remains **LEGACY_NATIVE**)  
**Rule:** Do not invent Safepay APIs. Do not invent COF renewal. Default `BILLING_CHECKOUT_MODE=legacy` until ops enables `atoms`.

---

# Chosen architecture (Sep 4, 2026) — HYBRID

**Decision:** Ship **Atoms for first paid checkout UX** + keep **Safepay native `sub_*` for renew/cancel** where available.

```text
ATOMS_HYBRID (new paid, when BILLING_CHECKOUT_MODE=atoms)
  → /billing/pay + Atoms (card + 3DS)     ✅ proven Phase 0
  → PaymentAttempt SUCCEEDED
  → Subscription ACTIVE (period from BillingPlan)
  → store payment_method (pm_*)
  → renewals: until unscheduled_cof proven, fall back to hosted
      createSubscription (LEGACY) or PAST_DUE + “update payment”
  → cancel: native cancel API if sub_* present; else AIDE-only cancel

LEGACY_NATIVE (default + all existing rows)
  → hosted createSubscription /subscribe
  → subscription_* webhooks
  → cancel via POST /client/subscriptions/v1/{sub}/cancel
```

**Do not** invent COF renewal. Default flag remains `legacy` until ops enables `atoms`.

---

## Desired UX (new paid users, atoms mode)

```text
AIDE plan pick
 → /billing/pay?planId=…
 → POST /api/billing/payment-session (amount from BillingPlan only)
 → Safepay customer + tracker + authToken
 → Atoms CardCapture + PayerAuthentication
 → do_capture + do_card_on_file
 → POST /api/billing/confirm-atoms (owned attempt) → ACTIVE + store pm_*
 → renewals: native hosted fallback / PAST_DUE until COF proven
```

Existing paid rows stay **`LEGACY_NATIVE`** (hosted `createSubscription` + subscription_* webhooks).

---

## Feature flag

```text
BILLING_CHECKOUT_MODE=legacy|atoms   # default: legacy
```

| Mode | Paid CTA | Activation |
|------|----------|------------|
| `legacy` | `POST /api/billing/checkout` → hosted `/subscribe` | `subscription_payment:complete` webhook |
| `atoms` | `/billing/pay` → payment-session | `POST /api/billing/confirm-atoms` |

---

## Phase checklist (sequence)

### PHASE 0 — Sandbox POC (HARD GATE)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 0.1 | Inventory SDK / Atoms / node-core | ✅ | `@sfpy/node-sdk`, `@sfpy/atoms@0.3.7`, `@sfpy/node-core@0.3.5` |
| 0.2 | Guest customer create → `cus_*` | ✅ | Sandbox `POST /user/customers/v1/` → 201 |
| 0.3 | Payment session → `track_*` | ✅ | `POST /order/payments/v3/` `{amount,currency,customer?}` → tracker |
| 0.4 | Auth token for Atoms | ✅ (API) | `safepay.authorization.create()` / passport token string |
| 0.5 | Atoms CardCapture renders (no PAN to AIDE) | ✅ | User POC `/test/safepay-atoms` Sep 4 |
| 0.6 | 3DS challenge + frictionless | ✅ (challenge) | Log: `3DS challenge required` → OTP → `3DS success` |
| 0.7 | `do_capture` + `do_card_on_file` | ✅ (field) | Success payload: `payment_method=pm_*` (Atoms COF flags on) |
| 0.8 | Persist / list instrument on customer wallet | 🟡 | `pm_*` on 3DS success; wallet often empty — auto-probe via `/api/test/safepay-atoms-reuse` after pay |
| 0.9 | Second charge without re-entering card | ⬜ **BLOCKER** | `unscheduled_cof` still 400; tracker+`payment_method` → `PROCESS_TRANSIENT_TOKEN` (payload incomplete) |
| 0.10 | Renewal webhooks + idempotency | ⬜ | Depends on 0.9 |
| 0.11 | Gate decision | ✅ **HYBRID GO** | Atoms first pay yes; COF renew no — keep native / PAST_DUE path |

**Gate rule:** Full AIDE-managed COF renewals stay blocked until 0.9. Hybrid Atoms first-pay may ship behind `BILLING_CHECKOUT_MODE=atoms`.

**Phase 0 commands**

```bash
npm run billing:phase0          # API probes (customer + session)
# then open /test/safepay-atoms while npm run dev (Atoms UI)
```

---

### PHASE 1 — Database / domain + hybrid live path

| # | Item | Status |
|---|------|--------|
| 1.1 | `Subscription.billingMode` (`LEGACY_NATIVE` \| `ATOMS_HYBRID`) | ✅ |
| 1.2 | Backfill existing → `LEGACY_NATIVE` | ✅ |
| 1.3 | `PaymentAttempt` model + indexes | ✅ |
| 1.4 | `safepayPaymentMethodRef` (`pm_*`) | ✅ |
| 1.5 | Migration non-destructive review | ✅ |
| 1.6 | `BILLING_CHECKOUT_MODE` + pay page + APIs | ✅ |

---

### PHASE 2 — Customer service

| # | Item | Status |
|---|------|--------|
| 2.1 | Canonical `ensureSafepayCustomerForPayment` (race-safe) | ✅ |
| 2.2 | Stop `SafepayCustomerKick` as prerequisite | 🟡 still on plans page |
| 2.3 | Create customer only at payment prep | ✅ (atoms path) |
| 2.4 | Parallel-create test | ⬜ |

---

### PHASE 3 — Payment session API

| # | Item | Status |
|---|------|--------|
| 3.1 | `POST /api/billing/payment-session` | ✅ |
| 3.2 | Price only from `BillingPlan` | ✅ |
| 3.3 | Create `PaymentAttempt` + tracker | ✅ |
| 3.4 | Return browser-safe session fields | ✅ |
| 3.5 | Auth + ownership tests | ⬜ |

---

### PHASE 4 — `/billing/pay` + Atoms

| # | Item | Status |
|---|------|--------|
| 4.1 | Page + `AtomsCheckoutForm` | ✅ |
| 4.2 | No Safepay login/signup UX | ✅ |
| 4.3 | CardCapture → PayerAuth → capture/COF | ✅ |
| 4.4 | Never send PAN/CVV to AIDE | ✅ |

---

### PHASE 5 — Webhooks + state machine

| # | Item | Status |
|---|------|--------|
| 5.1 | Keep native `subscription_*` handlers | ⬜ |
| 5.2 | Add Atoms/payment events from Phase 0 | ⬜ |
| 5.3 | Correlate → `PaymentAttempt` → `Subscription` | ⬜ |
| 5.4 | Duplicate webhook harmless | ⬜ |
| 5.5 | Disable sandbox redirect activate for `AIDE_COF` | ⬜ |

---

### PHASE 6 — Instrument persistence

| # | Item | Status |
|---|------|--------|
| 6.1 | Persist verified field only | ⬜ |
| 6.2 | No PAN/CVV storage | ⬜ |

---

### PHASE 7 — Recurring worker

| # | Item | Status |
|---|------|--------|
| 7.1 | Only after Phase 0.9 proven | ⬜ |
| 7.2 | Due `AIDE_COF` selection + lock | ⬜ |
| 7.3 | Renewal `PaymentAttempt` + idempotent charge | ⬜ |
| 7.4 | Success / PAST_DUE / retry policy | ⬜ |

---

### PHASE 8 — Legacy compatibility

| # | Item | Status |
|---|------|--------|
| 8.1 | `LEGACY_NATIVE` untouched | ⬜ |
| 8.2 | Native renewals still work | ⬜ |

---

### PHASE 9 — Frontend migration

| # | Item | Status |
|---|------|--------|
| 9.1 | Paid CTA → payment-session → `/billing/pay` when flag on | ⬜ |
| 9.2 | FREE path unchanged | ⬜ |
| 9.3 | Keep `/api/billing/checkout` for legacy | ⬜ |

---

### PHASE 10 — Status API + success UX

| # | Item | Status |
|---|------|--------|
| 10.1 | Poll payment-session status | ⬜ |
| 10.2 | Webhook authoritative for ACTIVE | ⬜ |

---

### PHASE 11 — Tests

| # | Item | Status |
|---|------|--------|
| 11.1 | Unit / integration / E2E matrix | ⬜ |
| 11.2 | Legacy regression suite | ⬜ |

---

### PHASE 12 — Security

| # | Item | Status |
|---|------|--------|
| 12.1 | Secrets server-only | ⬜ |
| 12.2 | HMAC, ownership, DB price | ⬜ |

---

### PHASE 13 — Observability

| # | Item | Status |
|---|------|--------|
| 13.1 | Structured billing events (no card data) | ⬜ |

---

### PHASE 14 — Feature flag + rollout

| # | Item | Status |
|---|------|--------|
| 14.1 | Default `legacy` | ⬜ |
| 14.2 | Sandbox → internal → % rollout | ⬜ |

---

## Phase 0 — Verified contracts (sandbox, Sep 4, 2026)

### Customer

- **Endpoint:** `POST https://sandbox.api.getsafepay.com/user/customers/v1/`
- **Auth:** `X-SFPY-MERCHANT-SECRET` + `Authorization: Bearer <SAFEPAY_V1_SECRET>`
- **Body:** `first_name`, `last_name` (len ≥ 2), `email`, `phone_number`, `country`, `is_guest`
- **Response:** `data.token` = `cus_*`

### Payment session (Atoms tracker)

- **Endpoint:** `POST /order/payments/v3/`
- **Working body:** `{ amount, currency: "PKR", customer?: "cus_*" }`
- **Response:** `data.tracker.token` = `track_*`, `data.tracker.client` = merchant `sec_*`, `mode: "payment"`, `entry_mode: "flex"`
- **Atoms props (documented):** `tracker` + `authToken` (from `authorization.create()` / passport)
- **Atoms COF flags (documented):** `authorizationOptions: { do_capture: true, do_card_on_file: true }`
- **Success type (Atoms d.ts):** `payment_method?: string` — treat as **candidate** instrument id until sandbox success payload confirms

### NOT proven (BLOCKERS for Phase 7)

| Attempt | Result |
|---------|--------|
| `mode: "subscription"` + `customer: cus_*` | 400 `missing customer` |
| `mode: "unscheduled_cof"` + `customer: cus_*` | 400 `missing customer` |
| `mode: "subscription"` + `user: cus_*` | 404 could not find customer |
| Dedicated `/unscheduled_cof` path | No working endpoint found |
| Instrument reuse charge | Not run (no saved instrument yet) |

**Closest supported architecture if COF renewal stays unproven:** keep **LEGACY_NATIVE** hosted Safepay plans for recurring; use Atoms only for one-shot if product accepts manual renew — **or** get Safepay support docs for MIT/`unscheduled_cof` with guest customers.

---

## Dependency graph

```text
Phase 0 (gate)
  ↓
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
                              ↓
                           Phase 5 ──→ Phase 6
                              ↓
                    Phase 7 (needs 0.9)
                              ↓
Phase 8 (parallel anytime after 1.1)
  ↓
Phase 9 → 10 → 11 → 12 → 13 → 14
```

Parallelizable after Phase 0 GO: Phase 8 docs/tests scaffolding with Phase 1–2.
