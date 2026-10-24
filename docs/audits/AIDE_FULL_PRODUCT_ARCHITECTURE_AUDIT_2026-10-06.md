# Aide — Full Product & Architecture Audit

**Prepared:** 6 October 2026  
**Scope:** Whole product as it exists in this repository today (Stage 6 freeze + F01–F13 + Levels 1–3).  
**Audience:** Owner / eng who need to understand *what* Aide is, *how* every major path works, *why* it is built that way, and *how a user runs the full product*.  
**Authority docs:** `AGENTS.md`, `docs/ARCHITECTURE_FREEZE_STAGE6.md`, `docs/SHIPPED_FEATURES.md`, `docs/shipped/LEVEL_*.md`, `docs/claude/COMPETITIVE_DEEP_AUDIT.md`.  
**Related short canvas:** Cursor canvas `aide-architecture-audit.canvas.tsx` (summary only). This file is the deep read.

---

## 1. Executive summary

**Aide** is a Next.js full-stack **AI customer-support and customer-insights** SaaS. A business owner creates an **agent**, loads **knowledge**, optionally connects **HTTP/MCP tools**, embeds a **webchat** (or receives **email**), hands hard chats to a **human desk**, and reads **analytics**. End customers never see owner secrets; the LLM never becomes the source of identity, tenant, or write approval.

| Question | Answer today |
| --- | --- |
| What is it? | AI support agent platform (console + embed + desk + billing + admin) |
| Is Level 1–3 done? | Yes — L1 B1–B9, L2 P1–P8 (WhatsApp deferred), L3 L1–L8 (opt-in advanced) |
| Trust model? | Frozen: `DATA ≠ AUTHORITY` |
| Go-live status? | Engineering **CONDITIONAL_YES** — owner checklist still incomplete |
| Main channel gap vs Fin/Decagon? | Hybrid retrieve still opt-in; crawl tick not a true cron; TTFT polish; WhatsApp/voice/SSO deferred |

One-line product promise: *“Build a support agent that answers from your knowledge and allowlisted tools, escalates honestly to humans, and never lets the model invent authority.”*

---

## 2. What the product is (and is not)

### 2.1 Is

- Multi-tenant **workspace** SaaS with Auth.js sessions.
- Per-agent **knowledge base** (text/FAQ, PDF, HTTPS crawl) with lexical retrieve and optional hybrid RAG.
- **Orchestrated tool loop** (HTTP actions, MCP, builtins like handoff / web search / conversation meta).
- **Public embed** with origin locking, rate limits, conversation access tokens.
- **Human desk** (inbox claim/reply/resolve, SLA, assignment, copilot).
- **Billing gate** (plans / SafePay; Free plan for local unlock).
- **Platform admin** console (seeded admins; non-admins get 404 on `/admin`).
- Optional **Level 3**: Auto-QA, knowledge-gap drafts, procedures, resolution charges, PII redaction, tool shortlist, simulation, A/B revisions.

### 2.2 Is not

- A raw ChatGPT wrapper with no tenant boundary.
- A marketplace of 100 SaaS connectors (HTTP/MCP exist; depth is limited).
- WhatsApp / voice / native mobile / SSO-ready enterprise IdP (deferred).
- A product where empty knowledge auto-falls back to the open web (source routes stay explicit).

---

## 3. Personas and how they use the product

### 3.1 Business owner (primary)

1. `/register` → `/login`.
2. Chooses a **billing plan** (post–2026-09-01 signups are not grandfathered Free).
3. Completes onboarding if required.
4. Creates an **agent** (`/agents/new`).
5. Adds **knowledge** (FAQ / PDF / crawl URLs + optional semantic RAG).
6. Optionally configures **Tools** (HTTP + MCP), **guidance**, **procedures**, **support hours**.
7. **Tests** in Studio (`/agents/[id]/test`) — sees sources, retrieval mode, confirmations.
8. **Customizes** appearance and copies **embed** snippet.
9. Watches **Inbox** for handoffs and **Analytics** for volume / resolution / QA.
10. Uses **Settings** (workspace, billing, developers/webhooks/API keys), **Version history**, **Simulation**, **A/B** as needed.

### 3.2 Workspace teammate

- Invited into a workspace with desk permissions (read / reply / manage).
- Uses **Human desk** to claim waiting chats, reply, use copilot, resolve.
- Does not own billing or agent delete unless role allows.

### 3.3 End customer (visitor)

- Meets the agent on the merchant site via `embed.js` → iframe `/w/[publicKey]`.
- Or emails an inbound address (Resend) → conversation in Inbox.
- May be guest or “logged-in” via host-issued identity token / traits.
- Can ask for a human → CTA / second ask → desk; AI pauses until resolve.
- Never receives API keys, tool credentials, or other tenants’ data.

### 3.4 Platform admin

- Password-only bootstrap users from `prisma/admins.local.json` (not from `.env`).
- `/admin` for users, suspend, settings, billing plans, audit.
- Google login blocked for admin role.

### 3.5 The LLM (not a persona, but a role)

| May | Must not |
| --- | --- |
| Choose among allowlisted tools | Approve WRITE / invent tools |
| Draft final customer wording | Change `agentId` / workspace / subject |
| Ask clarifying questions | Treat tool/KB/web text as permissions |

---

## 4. End-to-end owner journey (detailed)

```text
Register/Login
  → Billing unlock (subscribe FREE or paid)
  → Dashboard / Agents
  → Create Agent (prompt, welcome, answer style)
  → Knowledge (TEXT / PDF / crawl + optional hybrid RAG)
  → Tools hub (HTTP / MCP / builtins policy)
  → Guidance / Procedures / Support hours (optional)
  → Studio Test (grounded chat)
  → Customization + Deploy snippet
  → Live origin locks + crawl queue
  → Visitors chat on /w/[publicKey]
  → Handoff → Inbox human → Resolve
  → Analytics + Auto-QA (if enabled)
  → Revisions / Simulation / A/B (optional)
```

### Why this order matters

- **Billing before agents:** `requireProductAccess` returns `402 billing_required` so new accounts cannot create agents unpaid.
- **Knowledge before embed:** Without docs, the agent only has GENERAL/tool paths; setup checklist warns (B7).
- **Studio before deploy:** Owner sees grounding and confirm UX before public traffic.
- **Origin lock on first live embed:** Prevents random sites from stealing the public key widget; also seeds crawl.

---

## 5. Runtime & folder architecture

### 5.1 Process model

| Piece | Path | Role |
| --- | --- | --- |
| Always-on server | `server.js` | Same Node process: Next.js request handler + Socket.IO realtime |
| App Router UI | `app/(app)`, `app/(auth)`, `app/admin`, `app/w` | Owner console, auth, admin, public widget |
| HTTP APIs | `app/api/**` | Thin: parse → auth → service → JSON/stream |
| Business logic | `lib/services/**`, `lib/actions/**`, `lib/orchestrator/**` | Chat, handoff, billing, tools, PEP |
| Schema | `prisma/schema.prisma` + `prisma/migrations/` | Neon PostgreSQL |
| Realtime | `realtime-gateway/`, `lib/realtime/`, `workers/` | Rooms, outbox, Redis stream |
| Embed script | public `embed.js` | Injects iframe pointing at `/w/[publicKey]` |

**Hosting note:** Long-lived websockets want always-on Node (e.g. Render). Vercel remains useful for HTTP deploys but is not the target topology for one-port Socket.IO.

### 5.2 Stack

- Node **22+**, Next.js **16** App Router, React **19**, JavaScript/JSX (no new TS app source).
- Prisma **7** + Neon (`DATABASE_URL` pooled, `DIRECT_URL` migrate).
- Auth.js / NextAuth **v5**.
- OpenAI (chat + optional `text-embedding-3-small` + hosted web search).
- Tailwind / shadcn UI, npm lockfile.

### 5.3 Trust for every server request

1. Authenticate (session **or** public key + origin + conversation access token).
2. Authorize against workspace / agent / conversation.
3. Validate body / params at the boundary.
4. Scope DB reads/writes to that tenant.
5. Never promote LLM/tool/KB text into authority.

---

## 6. Frozen trust path (how a chat turn works)

```text
USER
  → AUTH (session | embed customerSubject | end-user token)
  → TRUSTED CONTEXT (agentId, workspaceId, conversationId, claims)
  → ORCHESTRATOR (runTurn / loop — LLM proposes tool_calls only)
  → SOURCE ROUTER (STORE | WEB | GENERAL | MIXED)
  → POLICY PEP (evaluateActionPolicy + authz binding)
  → TOOL GATEWAY (invokeOneTool allowlist)
       → Knowledge (stuffed retrieve — not a tool)
       → HTTP AgentAction
       → MCP AgentMcpTool
       → Builtins (handoff / meta / web_search)
  → RESULT FENCE (untrusted-result)
  → ORCHESTRATOR (observe → final text)
  → ANSWER
```

**Invariant:** `DATA ≠ AUTHORITY`. Knowledge pages, web HTML, tool JSON, and model prose never set identity, confirmation, tenant, or allowlists.

### 6.1 Step-by-step inside one turn

1. **Route** (`app/api/agents/[id]/chat` or public chat) validates input, attaches `x-request-id`.
2. **`chat.service.js`**
   - Loads agent for user **or** public agent by key + origin.
   - Ensures conversation ownership / access token.
   - Blocks AI if desk `aiPaused` / waiting human.
   - Optionally redacts PII for **storage** (L6) while the model may still see original for this turn.
   - Builds turn context via `buildAgentTurnContext` (`turn-context.js`).
3. **`turn-context.js` (trusted assembly — no LLM yet)**
   - History (≤20 messages).
   - Knowledge retrieve (lexical and/or hybrid if `semanticRagEnabled`).
   - Source route from utterance + sticky/clarify signals.
   - Enabled actions shortlist (keyword ± semantic tool shortlist).
   - Guidance rules, customer traits, procedure advance, reply language.
   - System prompt assembly.
4. **`runTurn` → `runOrchestratorLoop`**
   - Offers filtered tools/descriptors.
   - Model may request tools; each call hits PEP → gateway → fence.
   - Caps: **3** steps, **25s** deadline, **2** concurrent outbound.
   - Handoff often **deferred** when batched with answerable tools and customer did not ask for a human (B4).
5. **Persist assistant message**, emit NDJSON stream events if streaming.
6. **`after()`** side work: classify category/sentiment, schedule QA / resolution charge / retention (lazy catch-up capped).

### 6.2 Source routes (why no silent web fallback)

| Route | Web search tool | WRITE tools | Intent |
| --- | --- | --- | --- |
| **STORE** | Stripped | Allowed with confirm | Answer from KB / store tools |
| **WEB** | Allowed if agent flag + key | Stripped | Fresh / online asks |
| **GENERAL** | Stripped | Stripped | Chitchat / no store facts |
| **MIXED** | Allowed | Allowed with confirm | Compare store vs online carefully |

Empty knowledge does **not** auto-open the web. That keeps demos honest and blocks “hallucinated research” when the owner forgot to upload docs.

### 6.3 Confirmation lifecycle (WRITE)

```text
PENDING → APPROVED (CONFIRMED) → CONSUMED
         ↘ DENIED | EXPIRED
```

- Bound to `actionId` XOR `mcpToolId`, `argsHash`, conversation, actor.
- One-shot consume; replay blocked.
- Studio and embed show confirm UI; resume turn forces the confirmed tool (no escape to handoff).

---

## 7. Subsystem deep dives

### 7.1 Auth, workspace, product gate

| Concern | Mechanism |
| --- | --- |
| Session | Auth.js credentials (+ optional Google for non-admin) |
| Product unlock | Subscription in open statuses; `getAppAccessGate` / `requireProductAccess` |
| Tenant | Workspace membership; agents owned under workspace |
| Admin | Role `ADMIN`; `/admin` guarded; reserved emails cannot self-register |

**Why:** Separates “can log in” from “can spend AI / create agents,” and keeps platform operators out of the normal UX.

### 7.2 Agents & revisions

- Agent holds prompt, welcome, answer style, web search flag, customization JSON, guidance, procedures, `semanticRagEnabled`, `semanticToolShortlist`, `abTest`, email channel, etc.
- **Version history** snapshots prompt/config; restore is explicit.
- **A/B (L8):** bucket by stable **visitor subject** (else conversation id); overlay revision fields in memory; **never auto-promote** winner.

### 7.3 Knowledge

**How retrieve works**

1. Load enabled docs for the agent.
2. Resolve query (typo normalize, carry utterance for follow-ups).
3. Lexical / fuzzy chunk select into ≤ **12,000** character budget.
4. If semantic RAG on and pgvector available: embed query, vector search, **RRF** merge with lexical → `retrievalMode: hybrid`; else `keyword`.
5. Stuff selected chunks into system prompt (knowledge is **not** a tool).

**Crawl**

- HTTPS origin, hop/page caps, optional browser crawl for SPAs.
- Schedule intervals; refresh often triggered on embed ping / enqueue (competitive gap: no dedicated always-on crawl cron tick).

**Gaps (L3)**

- Unanswered clusters → draft FAQ suggestions.
- Owner/Admin **approve** only — never auto-publish (DATA ≠ AUTHORITY).

### 7.4 Tools (HTTP + MCP + builtins)

```text
listEnabledActionsForAgent
  → shortlist (keyword ± embeddings)
  → source-route filter
  → OpenAI tool descriptors
  → model tool_calls
  → evaluateActionPolicy (PEP)
  → invokeOneTool (SSRF, timeouts, authz binding, confirm, idempotency)
  → fence result string back to model
```

| Builtin examples | Purpose |
| --- | --- |
| `request_handoff` | Escalate (often deferred → offer team) |
| `get_conversation_meta` | Safe metadata |
| `web_search` | Hosted search when route allows |

**Why PEP first:** The model is untrusted for “should this write run?” The gateway enforces allowlist, SSRF, size limits, and confirmation.

### 7.5 Human desk & handoff

**Offer vs dispatch**

- Customer asks for a person (or clicks CTA) → handoff may **dispatch**.
- Model requests handoff while answering other tools → usually **deferred**; reply can show **Talk to team** (`showHandoffButton`).
- Procedure `handoff` step → **offer only** (no auto desk mutation).

**Desk flow**

1. Conversation `WAITING_HUMAN`, AI paused.
2. Inbox lists waiting threads; assignment / round-robin / SLA from workspace desk settings.
3. Human reply (PII redaction if privacy on).
4. Resolve → AI can continue after cooldown.

**Why:** Prevents “connecting you…” while the bot still owed an order status answer; keeps humans in control of writes to the desk state machine.

### 7.6 Public embed security

| Control | Purpose |
| --- | --- |
| `publicKey` | Identifies agent without owner session |
| Origin / Referer lock | First live site binds; spoofed origins 404 |
| Rate limits | Abuse on public chat / ping / handoff |
| `x-aide-conversation-access-token` | Binds history/feedback to mint origin + conversation |
| Identity token (optional) | Host-signed customer claims for tools |

Chat may work from the app origin for Studio-like tests; history/feedback still need a valid access token for that origin binding.

### 7.7 Streaming & realtime

- Chat streaming: **NDJSON** events (`meta`, `delta`, `tool`, `done`, `error`) via `lib/chat/server-stream.js`.
- Safe errors: no provider secrets / stack traces to the client.
- Realtime: Socket.IO on same port; Redis stream + outbox publisher for multi-device desk / billing / embed rooms.
- `/readyz` = realtime readiness; does **not** prove Next production build exists (Playwright harness must `npm run build` first).

### 7.8 Analytics & resolution

- Category / sentiment classify (often **after** HTTP return so TTFT feels faster).
- `answerState` / `resolvedBy` for resolution metrics.
- Unanswered clusters feed knowledge-gap UI.
- Auto-QA (L2/L3): after **24h quiet**, sample EMBED/EMAIL chats; judge returns JSON scores; lazy catch-up scores up to **3** other idle chats per `after()`.
- Resolution charges (L5): similar settle window; reverse on thumbs-down / handoff / reopen within 7 days; plan flags default **off**.

### 7.9 Billing

- Plans catalog; subscribe / SafePay checkout / webhooks.
- Conversation quotas on some plans.
- Product APIs gated until subscription unlocks.
- Resolution usage strip only when plan flags enable metering.

### 7.10 Email channel (Level 2 P8)

- Resend inbound webhook → parse → conversation `source: EMAIL`.
- AI reply and/or human desk with threading.
- Soft verify / welcome / day-1 nudges (lifecycle mail) separate from support inbound.

### 7.11 Privacy (Level 3 L6)

- Workspace `privacy.redactPii` + pattern toggles.
- Redact before durable `message.create` (chat + desk human).
- Retention days + sweep scheduler.
- Model/current-turn may still see original text for answering; store stays scrubbed.

### 7.12 Procedures (Level 3 L4)

- Owner builds steps: `ask` → `tool` → `say` → `handoff` → `end`.
- First matching trigger; TTL; pause on topic change; resume phrases.
- Broken / missing tools → instruction to admit failure + offer human.
- Effects feed the fenced procedure block into the normal model/tool loop — **no second executor**.

### 7.13 Simulation (Level 3 L8)

- Dry-run question list against agent config.
- WRITE tools not executed; results never bill or pollute analytics.
- Cancel API + UI for PENDING/RUNNING runs.

---

## 8. Major API surfaces (mental map)

| Area | Examples |
| --- | --- |
| Auth | `/api/auth/register`, Auth.js session, verify-email |
| Agents | `/api/agents`, knowledge CRUD, revisions, simulations, ab-stats |
| Chat | `/api/agents/[id]/chat`, public `/api/public/agents/[publicKey]/chat` |
| Embed | ping, feedback, files, handoff, conversation GET |
| Desk | `/api/inbox`, conversation reply / resolve / claim / copilot |
| Analytics | `/api/analytics/*` |
| Billing | plans, subscribe, webhooks, resolution-usage |
| Admin | `/api/admin/*` |
| Health | `/api/health`, `/healthz`, `/readyz` |

Routes stay thin; reusable logic lives under `lib/`.

---

## 9. Operational caps (frozen defaults)

| Cap | Value | Why |
| --- | --- | --- |
| Max tool steps | 3 | Bound cost / confusion |
| Tool-loop deadline | 25 s | Fail closed before serverless death |
| Concurrent outbound | 2 | Protect upstreams |
| HTTP timeout | 8 s | Fast fail |
| Web search timeout | 12 s | Hosted search budget |
| Knowledge budget | 12k chars | Prompt size + grounding focus |
| History | 20 messages | Context window hygiene |
| Confirmation TTL | 10 min | Stale approve risk |
| WRITE idempotency TTL | 15 min | Safe retries |

Change only with abuse / latency / regression evidence (freeze change control).

---

## 10. Feature inventory by era

### F01–F13 (platform)

Errors/logging, speed/DB/rate limits, production tests, design system, test studio, admin security/console, knowledge search, prompts/style, agent actions + universal authz packs, human desk, tools hub, crawl schedule, customer docs, etc. See `docs/SHIPPED_FEATURES.md`.

### Level 1 — reliable answers (B1–B9)

Tool typos/follow-ups, entity filter + not-found honesty, freshness→web, deferred handoff, reply language, support hours, setup warnings, clear public access errors, realtime deploy notes.

### Level 2 — ops & channels (P1–P8)

Resolution metrics, profile/guidance, desk assignment/SLA, copilot, versioning, proactive rules, webhooks/API keys, email inbound. **WhatsApp deferred.**

### Level 3 — advanced (L1–L8)

Semantic RAG, Auto-QA, knowledge suggestions, procedures, resolution pricing ledger, PII/retention, semantic tool shortlist, simulation + A/B. **Off until configured.**

---

## 11. Testing & verification map

| Command | What it proves |
| --- | --- |
| `npm run test:product` | Live register→plan→agent→knowledge→studio chat→analytics→isolation |
| `npm run test:f12e2e` | Embed handoff → desk reply → resolve → cooldown |
| `npm run test:shipped` | F01–F13 + orchestrator contract smokes |
| `npm run test:level3` | L1–L8 unit/contract + tool shortlist |
| `npm run test:billing` | Plan catalog + gate contracts |
| `npm run test:bugfix` | Origin lock + access token + unauth matrix (needs FREE plan activate) |
| `npm run test:realtime-phase2-browser` | Playwright desk/embed realtime (needs production build) |
| `npm run lint` / `npm run build` | Static quality / production compile |

Harness rule: do not weaken PEP/SSRF/confirm to make a test green.

---

## 12. Competitive position (honest)

| Keep (strength) | P0 gaps | P1–P2 gaps |
| --- | --- | --- |
| Explicit trust path, confirm, fence, SSRF | Hybrid default; crawl tick; stream TTFT | Deeper connectors; MIXED UX; WhatsApp/voice/SSO |

Aide’s moat is **safety architecture**, not connector count. Demo pain is freshness + meaning-first retrieve + first-token feel.

---

## 13. Production readiness

`docs/PRODUCTION_READY_SIGNOFF.md` remains **CONDITIONAL_YES**:

- Automated trust-path gates green.
- Owner must still complete manual smoke, monitoring agreement, and flip unconditional YES.
- Secrets: `AUTH_SECRET`, `ACTIONS_IDENTITY_SECRET`, `ACTIONS_CREDENTIALS_KEY`, provider keys, webhook secrets — never in client.
- Migrations: `prisma migrate deploy` before promoting dependent code (no auto-migrate on Neon/Vercel).

---

## 14. Architecture diagrams (reference)

### 14.1 Product topology

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Owner browser│────▶│ server.js        │────▶│ Neon PG     │
│ Studio/Inbox │     │ Next + Socket.IO │     │ Prisma      │
└─────────────┘     └────────┬─────────┘     └─────────────┘
                             │
┌─────────────┐              │ Redis stream / outbox
│ Site visitor│──embed.js───▶│
│ /w/publicKey│              ▼
└─────────────┘     OpenAI · HTTP tools · MCP · Resend · SafePay
```

### 14.2 Authority vs data

```text
AUTHORITY (trusted)          DATA (untrusted)
─────────────────            ────────────────
Session / admin role         LLM output
Workspace membership         Knowledge chunks
Agent ownership              Web pages
Public key + origin          Tool / MCP bodies
Access token                 Customer free text
Confirmation rows            Guidance / procedure prose
Allowlists / PEP             Auto-QA judge JSON
```

Nothing in the right column may rewrite the left.

---

## 15. Glossary

| Term | Meaning |
| --- | --- |
| **PEP** | Policy Enforcement Point — allow/deny/confirm before tools |
| **Fence** | Treat tool/web bodies as untrusted data in the next model step |
| **Studio** | Owner test chat at `/agents/[id]/test` |
| **Desk** | Human inbox for handed-off conversations |
| **Hybrid** | Lexical + vector RRF knowledge retrieve |
| **Settle** | 24h quiet before QA score / resolution charge |
| **Grandfather Free** | Pre-launch accounts auto Free; new signups choose a plan |

---

## 16. Document control

| Item | Value |
| --- | --- |
| Path | `docs/audits/AIDE_FULL_PRODUCT_ARCHITECTURE_AUDIT_2026-10-06.md` |
| Supersedes | Informal chat summaries; does not replace freeze / shipped archives |
| Update when | Trust path, channels, or go-live gates change |
| Do not use as | Open backlog (use `OPEN_SEQUENCE.md` + competitive audit) |

*End of audit.*
