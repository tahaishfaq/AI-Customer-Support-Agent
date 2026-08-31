# Aide — What to do next

**Last update:** Aug 30, 2026  
**Remaining work (ordered):** [`OPEN_SEQUENCE.md`](OPEN_SEQUENCE.md)  
**Shipped:** [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) · `npm run test:shipped`

**Rule:** One track at a time. Workspace isolation · origin-locked embed · insights-native · inspect-only admin.

---

## 1. Sequence (do in order)

| # | Track | Status | Doc |
|---|--------|--------|-----|
| **1** | **F00** live DoD + demo | 🚧 **Now** | [`F00_PROGRESS.md`](features/F00_PROGRESS.md) · [`F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md) |
| **2** | **F11-U** owner live tick | Eng ✅ · live open | [`F11_UNIVERSAL_AUTHZ_PLAN.md`](features/F11_UNIVERSAL_AUTHZ_PLAN.md) |
| **3** | **F12-U U4** internal notes | ✅ | [`F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) |
| **4** | **F12-U U5** CSAT | ✅ | [`F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) |
| **5** | **F10** Semantic RAG | If KB pain | [`F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) |
| — | Deferred / OOS | Later | §3 below · [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) |

---

## 2. Already shipped (do not reopen)

| Layer | Doc |
|-------|-----|
| F01–F09 · UI D0–D9 · polish | [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) · [`UI_STRATEGY.md`](ui/UI_STRATEGY.md) |
| F11 actions + UX-1–4 · F11-U eng | [`F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md) |
| F12 desk U0–U5 | [`F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) |
| F13 Tools hub T0–T4 | [`F13_TOOLS_HUB.md`](features/F13_TOOLS_HUB.md) |
| F14 consent A–E | [`F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md) |

---

## 3. Deferred & internship OOS

| ID | Item | When |
|----|------|------|
| **UX-5** | OpenAPI / flow canvas | Product insists |
| **R6** | Redis for Actions | Scale pain |
| **L-BILLING** | Stripe / plans | Post-MVP |
| **L-TEAMS** | Workspace seats / RBAC | Post-MVP (unlocks desk U6) |
| **L-CHANNELS** | WhatsApp / Slack | Post-MVP |
| **L-SSO** · **L-ADMIN-STAFF** · **L-*** | See backlog | Post-MVP |

**Never:** train on private chats · open-web competitor scrape · full Zendesk/Botpress clone as “next”.

Detail: [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md).

---

## 4. Docs map (keep lean)

| File | Role |
|------|------|
| [`OPEN_SEQUENCE.md`](OPEN_SEQUENCE.md) | **Only** open ordered work |
| [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) | What shipped |
| [`F00_PROGRESS.md`](features/F00_PROGRESS.md) | Buffer ticks |
| [`F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md) | DoD / demo script |
| [`F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) | RAG when needed |
| [`F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md) | Actions reference |
| [`F11_UNIVERSAL_AUTHZ_PLAN.md`](features/F11_UNIVERSAL_AUTHZ_PLAN.md) | Authz + catalogs |
| [`F11_EDGE_CASE_REGISTRY.md`](features/F11_EDGE_CASE_REGISTRY.md) · businesses · BE cases | Catalogs |
| [`F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) | Desk reference |
| [`ARCHITECTURE_ACTIONS_AND_DESK.md`](features/ARCHITECTURE_ACTIONS_AND_DESK.md) | Architecture |
| [`UI_STRATEGY.md`](ui/UI_STRATEGY.md) · [`D0_DESIGN_SYSTEM.md`](ui/D0_DESIGN_SYSTEM.md) | Design |
| [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) | Long OOS |
| Audits (`AUDIT_*`) | Competitor notes (not build plans) |
