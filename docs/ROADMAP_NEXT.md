# Hapy — What to do next

**Last update:** Aug 2026  
**Shipped summary:** [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) · **Verify:** `npm run test:shipped`  
**Internship source:** `docs/Hapy — AI Customer Support & Customer Insights.docx` §28–32

**Rule:** One track at a time. Hapy identity: workspace isolation · origin-locked embed · insights-native · one inspect-only admin.

---

## 1. Where we are

| Layer | Status |
|-------|--------|
| Internship MVP journey | **Done** |
| Product extras (embed lock, crawl, customization, studio, admin) | **Done** |
| F01–F09 Week 3 quality | **Done** — [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) |
| Scheduled website re-crawl | **Done** |
| **F00 DoD / demo buffer** | 🎯 **NOW** — [`features/F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md) |
| F11 Agent actions | Next after F00 — [`features/F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md) |
| F12 Human desk | Alt next — [`features/F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) |
| F10 Semantic RAG | Only if KB pain — [`features/F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) |
| Internship §29 Out of Scope | **Later (brief plans below)** — deep build later |

---

## 2. Order of work (official)

| # | Track | Plan file | When |
|---|--------|-----------|------|
| **1** | **DoD / demo buffer** | [`F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md) | **Start now** |
| **2** | **F11 Agent actions** | [`F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md) | After buffer ✅ |
| **2-alt** | F12 Human desk | [`F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) | If story = human handoff |
| **3** | F10 Semantic RAG | [`F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) | KB > ~40 docs / ~80k chars or paraphrase pain |
| **Later** | Internship OOS items | §4 below | After F11 (or when product insists) |

**Default next numbered feature after buffer = F11** (tools). Not F10 by default.

---

## 3. Quick pick

| Goal | Do this |
|------|---------|
| Presentation / internship close | **F00** |
| “Bot calls our API” | **F11** |
| “Human takes over” | **F12** |
| “Huge FAQ / wrong chunks” | **F10** |
| Billing, WhatsApp, teams, fine-tune… | **§4 OOS later** — do not start in buffer week |

---

## 4. Internship Out of Scope → later roadmap (brief plans)

Source: docx **§29 Out of Scope** — *“future product opportunities.”*  
These are **not** MVP. Below = **short plan seeds**. Deep design only when that ID is opened.

| ID | Internship ❌ | What it means for Hapy | Why later | Brief plan (when we open it) |
|----|---------------|------------------------|-----------|------------------------------|
| **L-BILLING** | Billing · Stripe · Subscriptions | Plans, checkout, entitlement gates | Needs legal/ops; not DoD | Stripe Checkout → Customer + Subscription tables → gate agent count / messages → webhook sync → customer billing portal. See `POST_MVP_BACKLOG_PLAN` P3-BILLING |
| **L-TEAMS** | Team management · Advanced RBAC · Multi-tenant SaaS* | Invite members, roles (owner/editor/viewer) | Single-owner MVP enough | WorkspaceMember · invites · permission checks on agents/inbox · audit. *We already have workspaces; this is **team seats*** |
| **L-CHANNELS** | WhatsApp · Slack · Mobile app | Same agent on WA/Slack/native | Embed-first is Hapy identity | Channel connectors → Conversation adapter · verify webhooks. Mobile = PWA first, native later |
| **L-CRAWL-OPEN** | Website crawler (open) | Scrape any URL / competitor sites | We have **origin-locked** crawl + schedule | Extra paths on **same** origin first; open-web / competitor console = Never unless legal OK |
| **L-LLM-TRAIN** | Custom LLM training · Fine-tuning · Advanced ML | Train/fine-tune on data | **Never** train on private chats | Prefer prompt/RAG; if ever: approved public FAQ only + separate model id |
| **L-VECTOR-INFRA** | Complex vector DB infrastructure | Pinecone-scale platform | F08 enough until threshold | Opens as **F10** (Neon pgvector preferred) — not separate mega-infra |
| **L-FLOWS** | Flow canvas (competitor) | Visual bot builder | No canvas as home | Stay tools (**F11**); canvas only if product pivots |
| **L-SSO** | SSO / SAML (backlog) | Enterprise login | No enterprise sales yet | Auth.js enterprise provider · map groups → roles (needs L-TEAMS) |
| **L-ADMIN-STAFF** | Many platform admins (backlog) | Staff RBAC on `/admin` | One admin enough | AdminRole · scoped routes · still no act-as-user |
| **L-IMPERSONATE** | Act-as-user (avoid) | Admin operates as customer | Breaks trust | Prefer inspect + restore; if ever: time-boxed, audited, write-blocked |
| **L-PRODUCT-EXTRAS** | Streaming, model picker, citations UI, SPA crawl | Nice-to-haves | After F11 | One-by-one: stream tokens · cite chips · model enum · headless same-origin crawl |

### Never (do not plan a build)

| Never | Reason |
|-------|--------|
| Train on private customer conversations | Privacy |
| Open-web competitor scrape console | Legal + identity |
| Full Zendesk/Botpress omnichannel + canvas as “next” | Scope explosion |

More detail: [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md).

---

## 5. Feature catalog

| ID | Name | Status | Plan |
|----|------|--------|------|
| **F00** | DoD / demo buffer | 🎯 **NOW** | [`F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md) |
| F01–F09 | Quality stack | ✅ Shipped | [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) |
| Extra | Re-crawl schedule | ✅ Shipped | Knowledge page |
| **F11** | Agent actions | 🎯 Next after F00 | [`F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md) |
| F12 | Human desk | Alt | [`F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) |
| F10 | Semantic RAG | Later / pain | [`F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) |
| L-* | Internship OOS | Later | §4 table |

---

## 6. Steal vs protect

| Steal | Hapy way |
|-------|----------|
| Retrieve → answer → cite | F08 now; F10 later |
| Agent acts (tools) | **F11** allowlisted HTTP |
| Human handoff | **F12** workspace inbox |
| Train → test → deploy → analyze | Prove live in **F00** |

---

## 7. How to use this week

1. Open **[`F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md)** — tick DoD + rehearse demo.  
2. When F00 done, open **[`F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md)** Phase A (or F12/F10 if §3 says so).  
3. Do **not** start F11 + F12 + F10 together.  
4. Do **not** start L-BILLING / WhatsApp / fine-tune during buffer.  
5. After a later ID ships, update this file’s §1–§2.

---

## 8. Docs map

| File | Role |
|------|------|
| [`F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md) | **#1 detailed plan** — DoD, deliverables, demo script |
| [`F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md) | **Deep plan** — tools / HTTP actions |
| [`F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) | **Deep plan** — human inbox handoff |
| [`F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) | RAG when needed |
| [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) | What already shipped (simple) |
| Internship `.docx` | §29 OOS · §30 DoD · §31 deliverables |
| [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) | Long OOS / P3 detail |
