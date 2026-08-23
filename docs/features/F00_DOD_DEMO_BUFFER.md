# F00 — DoD / demo buffer (NOW — before F11)

**Status:** 🎯 **Do this first** — not a new product feature; close internship Definition of Done + demo.  
**Maps to:** internship `.docx` §30 Definition of Done · §31 Final Deliverables · §32 Success Criteria.  
**After this:** open **F11** (recommended) or F10/F12 per [`ROADMAP_NEXT.md`](../ROADMAP_NEXT.md).

> **Rule:** Prefer a **small polished demo** over starting F10/F11/F12 while DoD boxes are open.

---

## Why this track exists

Internship says: *smaller polished product > large unfinished app*.  
F01–F09 already shipped quality. Buffer = prove **live** that the MVP checklist is green and the **final presentation** is ready.

---

## Phase A — Scope & identity ✅ (locked)

### In scope

| Area | Meaning |
|------|---------|
| DoD §30 checklist | Every “MVP is complete when…” line verified on **deployed** app |
| Final deliverables §31 | Working MVP, repo, DB, API notes, DS notes, README, presentation |
| Demo script | 5–8 minute path that never fails |
| Responsive + critical errors | Already coded (F01/F04) — **re-verify live** |
| Live admin seed | Same Neon as Vercel |

### Out of scope (do **not** start here)

- F10 Semantic RAG · F11 Actions · F12 Desk  
- Billing / Stripe · Teams RBAC · WhatsApp/Slack · Fine-tune  
- Big UI redesign · New product modules  

### Identity guardrails

| Keep | Meaning |
|------|---------|
| Workspace isolation | Demo shows User A cannot see User B agents |
| Origin-locked embed | Demo shows widget locked to one site |
| Insights-native | Analytics / category / sentiment appear in demo |
| One platform admin | Inspect-only; no act-as-user |

---

## Phase B — DoD checklist (internship §30)

Tick on **production / Vercel preview**, not only localhost.

| # | DoD item | How to verify | Owner notes |
|---|----------|---------------|-------------|
| 1 | Register and login | Create new user on live URL; Google optional | |
| 2 | Create AI agent | Agents → New → name + prompt | |
| 3 | Add knowledge | TEXT FAQ + optional PDF | |
| 4 | Chat with AI | Studio **Test** tab | |
| 5 | Conversations in PostgreSQL | Conversations page lists thread | |
| 6 | Message metadata | Response time / roles visible or in API | |
| 7 | Categorized | Conversation category set after chat | |
| 8 | Sentiment analyzed | Sentiment on conversation / analytics | |
| 9 | Analytics calculated | `/analytics` numbers move | |
| 10 | Dashboard visualizes | Charts / KPIs render | |
| 11 | Business insights | Topics / trends / sentiment panels | |
| 12 | Responsive | Phone 375px + laptop 1280px | |
| 13 | Critical errors handled | Kill key briefly or force 401 → friendly UI | |
| 14 | Application deployed | Public HTTPS URL | |
| 15 | README complete | Setup, env, CI, embed, go-live | |
| 16 | GitHub organized | Clean branches; no secrets in repo | |
| 17 | Code reviewed | Both interns review PR / checklist | |
| 18 | Final demo prepared | Script + slides + backup video optional | |

**Done when:** all 18 checked on live (or written exception with lead approval).

---

## Phase C — Final deliverables (§31)

### 1. Working MVP

- [ ] Deployed URL bookmarked  
- [ ] Seed admin once against **prod** Neon (`npm run seed:admin`)  
- [ ] Smoke: `TEST_BASE_URL=<live> npm run test:product` (if secrets allow)

### 2. Source code

- [ ] `main` (or agreed branch) builds: `npm run build`  
- [ ] `.env` / secrets **not** committed  
- [ ] `npm run test:shipped` green locally  

### 3. Database

- [ ] Prisma schema in repo  
- [ ] `npx prisma migrate deploy` documented in README  
- [ ] Migrations applied on prod Neon  

### 4. API (documented REST)

Keep short — not OpenAPI required unless lead asks:

| Doc place | Content |
|-----------|---------|
| README “Product map” + Scripts | Main routes |
| Optional `docs/` one-pager | Auth, agents, chat, public embed, analytics |

Minimum list to mention in presentation:

- `POST /api/auth/register` · NextAuth session  
- `CRUD /api/agents` · knowledge · chat  
- `POST /api/public/agents/[key]/chat` · ping  
- `GET /api/analytics/*`  

### 5. Data science component (document approach)

Write **one short section** (README or slide):

| Piece | What Hapy does today |
|-------|----------------------|
| Classification | Category labels via LLM classify (after reply) |
| Sentiment | POSITIVE / NEUTRAL / NEGATIVE (etc.) on conversation |
| Insights | Aggregates on analytics dashboard |
| Knowledge “retrieve” | F08 lexical + fuzzy (not vector yet) |

### 6. Documentation

- [ ] README: local setup, env table, Neon pooler, seed admin, embed, CI secrets, go-live  
- [ ] [`SHIPPED_FEATURES.md`](../SHIPPED_FEATURES.md) for “what we built” story  
- [ ] [`ROADMAP_NEXT.md`](../ROADMAP_NEXT.md) for future  

### 7. Final presentation outline (§31)

| Slide | Content |
|-------|---------|
| Problem | Support tickets + no insights |
| Solution | Hapy agent + knowledge + embed + analytics |
| Architecture | Next.js · Prisma/Neon · Auth.js · OpenAI · Cloudinary |
| Tech choices | Why serverless, why origin lock, why no vectors yet |
| AI | Chat + classify + prompt builder (F09) |
| Data science | Category / sentiment / dashboard |
| Challenges | Crawl lock, rate limits, retrieve without RAG |
| Demo | Live walkthrough |
| Future | F11 actions · F12 desk · F10 RAG · OOS later (billing…) |

---

## Phase D — Demo script (5–8 min, fail-safe)

### Prep before audience

1. Two browsers / profiles: **User** + **Admin**  
2. Agent already has FAQ: refund / shipping / hours  
3. Answer style = Hybrid  
4. Optional: embed open on demo site tab  
5. Backup: short screen recording if Wi‑Fi dies  

### Script steps

| Min | Action | Show |
|-----|--------|------|
| 0:00 | Login as user | Dashboard |
| 0:30 | Open agent → Knowledge | FAQ list + crawl schedule mention |
| 1:00 | Test chat: “refund policy” | Answer + **sources** |
| 1:45 | Typo: “reunf” | Clarify or correct match |
| 2:15 | Conversations | Thread saved |
| 2:45 | Analytics | Category / sentiment / chart |
| 3:30 | Customization → Deploy | Snippet; open widget `/w/…` |
| 4:30 | Embed ask same FAQ | Public chat works |
| 5:15 | Logout → admin login | `/admin` overview |
| 6:00 | Users / agent inspect | Inspect-only story |
| 6:30 | Future slide | F11 / F12 / F10 — not building now |
| 7:00 | Q&A | |

### Demo failure fallbacks

| Fail | Fallback |
|------|----------|
| OpenAI down | Show degraded message (F01) + studio retry |
| Analytics slow | Show Conversations + Test chat only |
| Embed origin deny | Use studio Test tab as primary |

---

## Phase E — Live production checks

| Check | Command / action |
|-------|------------------|
| Health | `GET /api/health` → database ok |
| Shipped suite | `npm run test:shipped` |
| Product smoke | `TEST_BASE_URL=… npm run test:product` |
| Origin lock | `npm run test:bugfix` against live if secrets set |
| Admin | `npm run test:admin` with bootstrap env |
| Migrate | Prod Neon has latest migrations (incl. `crawlRecrawlHours`) |

### Env must match on Vercel

- `DATABASE_URL` (pooler) + `DIRECT_URL` for migrate machine  
- `AUTH_URL` / `NEXT_PUBLIC_APP_URL` = live HTTPS  
- `OPENAI_API_KEY`  
- `ADMIN_BOOTSTRAP_*` after seed  
- Cloudinary if avatars/PDFs used  

---

## Phase F — Responsive & polish pass

| Surface | Check |
|---------|-------|
| Login / register | Brand panel, mobile form |
| Dashboard | No horizontal overflow 375px |
| Agent studio tabs | Usable on phone |
| Analytics charts | Readable or stack |
| Embed widget | Mobile bubble + panel |
| Admin | Dense but scrollable |

Fix only **blockers** for demo — no redesign.

---

## Phase G — Repo & review

- [ ] Branch cleanup; PR descriptions clear  
- [ ] Both interns review: auth, chat, embed, admin  
- [ ] No `console.log` of PII; secrets scrubbed  
- [ ] `.gitignore` covers `.env`, `tmp/`  

---

## Phase H — Buffer “done when”

- [ ] All DoD §30 rows verified live  
- [ ] Presentation deck ready (Problem → Future)  
- [ ] Demo script rehearsed twice without crash  
- [ ] README + SHIPPED_FEATURES linked from talk track  
- [ ] Lead agrees: “MVP done; next engineering = F11 (or F10/F12)”  

Then update [`ROADMAP_NEXT.md`](../ROADMAP_NEXT.md): mark buffer ✅ and start F11 Phase A.

---

## Manual test (one sitting)

1. Open live URL → full script § Phase D.  
2. Phone Chrome → responsive § Phase F.  
3. `npm run test:shipped`.  
4. Ask teammate to follow README from zero → agent chat.  

---

## Steal (not clone)

Fin/Zendesk **demo story**: train → test → deploy → analyze — Hapy already has this path; buffer proves it live.
