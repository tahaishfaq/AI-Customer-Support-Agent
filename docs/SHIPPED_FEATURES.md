# Aide — Kya kya ship hua (F01–F13 + extras)

Yeh file simple language mein hai: **kyun banaya**, **kya improve hua**, aur **user ko kya feel hota hai**.

Tests ke liye technical detail alag file mein hai: `SHIPPED_FEATURES_TEST_APPENDIX.md` (developers / CI only).

**Check sab theek hai:** `npm run test:shipped` · Human desk: `npm run test:f12` · Actions: `npm run test:f11` · Universal: `npm run test:f11u` · Tools hub: `npm run test:f13`

**Aage ka kaam:** **[F00 DoD/demo](features/F00_DOD_DEMO_BUFFER.md)** (live ticks + B26 rehearsal) · Alt: [F10 RAG](features/F10_SEMANTIC_RAG.md) if KB pain. OOS: [`ROADMAP_NEXT.md`](ROADMAP_NEXT.md) §4.

---

## Ek nazar mein

| # | Naam | Kyun chahiye tha | User ko kya milta hai |
|---|------|------------------|------------------------|
| F01 | Errors & logs | App crash ya OpenAI down par white screen / ajeeb errors | Clear message + support ko trace karne ke liye request id |
| F02 | Speed & load | Analytics / chat slow; DB pool exhaust | Faster pages, chat zyada wait nahi, limits clear |
| F03 | Production tests | Deploy ke baad pata na ho kya toot gaya | CI + smoke scripts — merge se pehle check |
| F04 | Design / UI | Product cheap ya unfinished lagta tha | Teal Aide look, empty states, mobile theek |
| F05 | Agent test studio | Bot test karna mushkil; grounding dikhna nahi tha | Test chat + sources + suggested questions |
| F06 | Admin security | Admin APIs open hon to risk | Sirf admin login; har admin route protected |
| F07 | Admin console | Operator ko users dhundna mushkil | Filters, badges, quick links, less clutter |
| F08 | Knowledge search | Poora FAQ prompt mein nahi jaata; galat jawab | Sirf relevant hissa + typo fix + clarify |
| F09 | Prompts & style | Har agent alag tone; rules scattered | Short / detailed / hybrid answers; safe rules |
| F11 | Agent actions | FAQ mein live order/CRM nahi | Bot allowlisted API call karke real status batata hai |
| F11-U | Universal authz | Har business alag product maangta | 50 packs · Guest/Signed-in · Confirm · cross-user refuse |
| F12 | Human desk | AI stuck / angry user — koi insaan nahi | Embed se handoff → owner Inbox → same chat mein human reply |
| F13 | Tools hub | Actions / MCP / HTTP alag-alag feel | Ek **Tools** surface: Integrations · MCP · HTTP |
| Extra | Re-crawl schedule | Website ek bar crawl; content purana reh jata | User interval set kare — auto refresh |

---

## F01 — Errors aur logging

### Kyun add kiya?

Jab OpenAI down ho, crawl fail ho, ya login galat ho — user ko stack trace ya khamoshi nahi chahiye. Support team ko bina customer ki private chat copy kiye error dhundna chahiye.

### Kya improve hua?

- **Har API error** ab same shape: `{ error: { message, details } }` — frontend samajh jata hai kya dikhana hai.
- **Har response par `x-request-id`** — Vercel logs mein search karo, wahi error mil jayega.
- **Chat jab AI fail ho** → user message save rehti hai, assistant friendly fallback deta hai (200, crash nahi).
- **Logs safe** — poori chat / email log nahi hoti by default.
- **Knowledge page par crawl status** — queued / running / failed badge; fail par reason dikhta hai.
- **Register / login rate limit** par clear message (“too many attempts…”).
- **Maintenance mode** — normal user ko screen dikhti hai, admin alag.

### Simple examples

| Pehle | Ab |
|-------|-----|
| Chat → blank ya 500 | “AI abhi available nahi…” + message saved |
| Crawl fail → kuch pata nahi | Red badge + “Embed again…” |
| Error debug mushkil | Copy `x-request-id` from Network tab |

---

## F02 — Speed, DB, rate limits

### Kyun add kiya?

Analytics heavy queries se dashboard slow tha. Chat aur crawl same DB use karte hain — ek saath load par timeout ho sakta tha.

### Kya improve hua?

- **Analytics** — SQL aggregates + timeout; chart data cap; slow query par empty state, hang nahi.
- **Chat** — classify often **after** reply bhej dete hain taake user ko pehle jawab mile (insights thodi der baad update).
- **Knowledge prompt** — zyada chars nahi bhejte; retrieve se relevant hissa (F08 ke saath).
- **Crawl defer** — widget ping ke baad thodi delay se crawl start; chat ko DB breathing room.
- **Neon pool** — chota `PG_POOL_MAX`; `.env.example` mein pooler vs direct URL documented.
- **Rate limits** — ek jagah config (`rate-limit-config.js`); pub chat / studio / ping alag limits.
- **Duration headers** — kitna time laga, debug mein help.

### Simple examples

| Pehle | Ab |
|-------|-----|
| Analytics 30s+ spin | 15s timeout → friendly error |
| First chat message slow (+ classify wait) | Reply pehle, category baad mein |
| Crawl + chat same second → DB stress | Crawl 750ms defer (default) |

---

## F03 — Production testing & CI

### Kyun add kiya?

Code merge ho jaye aur production par register / embed / chat toot jaye — internship demo aur live app dono ke liye risk.

### Kya improve hua?

- **GitHub CI** — lint hamesha; F01–F09 contract tests; secrets hon to live HTTP smoke.
- **`test:product`** — register → agent → knowledge → chat → analytics (live URL par).
- **`test:bugfix`** — origin lock, embed security, workspace isolation.
- **`test:admin`** — admin login + console smoke.
- **README** — CI secrets, go-live checklist, branch protection notes.
- **Reserved admin email** — Google se admin account ban na sake.

### Simple examples

| Pehle | Ab |
|-------|-----|
| Manual “hope it works on Vercel” | `npm run test:shipped` locally + CI |
| Origin lock bug dubara | Regression script pakad leta hai |

---

## F04 — Design & Aide look

### Kyun add kiya?

Product ko professional support tool jaisa dikhna chahiye — teal brand, clean layout, mobile par usable.

### Kya improve hua?

- **Teal tokens** — `globals.css` variables; purple “AI slop” nahi.
- **Auth pages** — brand panel, clear login/register.
- **Dashboard & studio** — hero, tabs, less clutter; site preview stage for embed.
- **Empty states** — “No agents yet” + button; skeleton loaders.
- **Error states** — retry buttons; inline alerts.
- **Google sign-in** — click-to-load (privacy / perf).
- **Charts lazy load** — analytics page lighter first paint.
- **Avatars** — Cloudinary CDN URLs optimized.
- **Responsive** — 375px se 1280px tak readable.

### Simple examples

| Pehle | Ab |
|-------|-----|
| Generic form dump | One clear screen per task |
| Blank white on load | Skeleton → content |
| Heavy chart bundle upfront | Charts load when needed |

---

## F05 — Agent test studio

### Kyun add kiya?

Agent banane ke baad turant test karna zaroori — aur dekhna chahiye bot ne **kis knowledge** se jawab diya.

### Kya improve hua?

- **Test tab** — studio mein live chat without embed.
- **Used knowledge** — answer ke neeche source titles.
- **Suggested questions** — quick test prompts.
- **Grounding excerpt** — prompt mein kya gaya, preview (debug).
- **Degraded state** — AI fail → “Generation failed — Try again”, white screen nahi.
- **Cancel / timeout** — clear assistant message.

### Simple examples

| Pehle | Ab |
|-------|-----|
| “Bot ne kahan se likha?” | Source titles under reply |
| Test ke liye embed zaroori | Studio test tab enough |

---

## F06 — Admin security

### Kyun add kiya?

Admin APIs agar koi bhi hit kar le to users suspend / settings change ho sakta tha.

### Kya improve hua?

- **Har `/api/admin/*` route** — `requireAdmin` + session check.
- **Normal user `/admin`** → 404 (URL hide).
- **Admin Google login block** — sirf email + password.
- **Audit-friendly errors** — 401 with request id.
- **19 admin routes** smoke-tested.

### Simple examples

| Pehle | Ab |
|-------|-----|
| Admin API guess karke try | 401 without admin session |
| User sees /admin link | 404 for non-admin |

---

## F07 — Admin console polish

### Kyun add kiya?

Platform operator ko users, restore requests, agents jaldi dhundne chahiye — bina heavy page reload.

### Kya improve hua?

- **Users directory** — search / filters URL mein (shareable link).
- **Restore requests** — pending badge count.
- **Dashboard KPIs** — click → users / suspended / requests.
- **Agent inspect** — last conversation snippet; full knowledge body load nahi.
- **Workspace inspect** — embed origin, agent list compact.
- **Analytics admin view** — platform-wide numbers.

### Simple examples

| Pehle | Ab |
|-------|-----|
| Scroll poori user list | Filter + URL bookmark |
| Open agent → slow heavy load | Summary first, detail on demand |

---

## F08 — Smart knowledge pick (bina vectors)

### Kyun add kiya?

Pehle poora FAQ order mein prompt mein jaata tha — 12k chars ke baad cut. User “refund” pooche aur policy doc list ke end par ho to galat / generic jawab.

### Kya improve hua?

- **Relevant chunks** — question se match karke sirf useful paragraphs.
- **WEB site boost** — embed wali site ke pages priority.
- **Typo / fuzzy** — `reunf` → refund; Soundex / prefix / n-gram.
- **Clarify path** — agar do meanings hon to “Did you mean …?” (early return, extra LLM nahi).
- **Large doc hint** — UI batata hai “chat relevant sections use karega”.
- **Empty KB** — clear refuse message prompt mein.
- **F10 threshold doc** — ~40 docs ya ~80k chars par semantic RAG sochna.

### Simple examples

| Pehle | Ab |
|-------|-----|
| 50 FAQ → first 3 docs only in prompt | Best matching chunks for this question |
| `reunf policy` → “I don’t know” | Clarify or match refund FAQ |
| 12k char PDF → random cut | Scored sections |

---

## F09 — Prompts, rules, answer style

### Kyun add kiya?

Har agent ka system prompt alag likha hota tha — kabhi zyada lambi reply, kabhi knowledge ignore. Rules ek jagah nahi the.

### Kya improve hua?

- **`prompt-builder.js`** — system prompt + rules ek jagah build.
- **Answer style** (Edit agent):
  - **Short** — 2–4 sentences
  - **Detailed** — steps / lists
  - **Hybrid** — har message par bot choose kare short vs detailed
- **Recommended grounding template** — checkbox se safe default role text.
- **Classify hardened** — category/sentiment fail → GENERAL / NEUTRAL.
- **Caps** — prompt size limits; static rules cache.
- **Studio grounding preview** — test mein excerpt dikhe.

### Simple examples

| Pehle | Ab |
|-------|-----|
| Long essay on “hi” | Short style or hybrid picks brief |
| Rules copy-paste har agent | Template + central rules |
| Classify fail → weird category | GENERAL / NEUTRAL fallback |

---

## F11 — Agent actions (tools)

### Kyun add kiya?

Customer order status poochta hai — FAQ mein nahi hota ya purana hota hai. Bot sirf text bolta tha (“portal pe dekho”). Zendesk/Botpress jaisa **live API call** chahiye tha, bina flow canvas ke.

### Kya improve hua?

- **Customization → Actions** — Connection | Capabilities (catalog + Integrations hub) | Advanced; credentials encrypted; vertical packs (Brandly / Demo / Shopify / HubSpot starters)
- **Chat tool loop** — studio Test + embed dono; model tool call → server HTTP (SSRF-safe) → natural jawab
- **Demo order API** — `ORD-100` → Shipped (local test)
- **Studio timeline** — reply ke neeche **Called: get_order_status → 200**
- **Kill switch** — agent-wide actions off; per-action enable; templates; header `••••` redaction
- **Safety** — rate limits, daily workspace cap, GET cache, concurrency cap, ToolRun audit list
- **UX-1, UX-2, UX-3, UX-4** — capability cards, Try sample, connection health, Install Brandly / vertical packs (`test:f11-ux2`–`ux4`); UX-5 deferred

### Simple examples

| Pehle | Ab |
|-------|-----|
| “Order ORD-100?” → guess / FAQ miss | Live lookup → “Shipped…” |
| Random URL scrape | Sirf owner allowlisted URL |
| Flow canvas setup | Form + Test button / capability toggles |

**Detail:** [`features/F11_AGENT_ACTIONS.md`](features/F11_AGENT_ACTIONS.md) · `npm run test:f11` · `test:f11r` · `test:f11-ux2`–`ux4`

### O01 — Orchestrator layer (runtime)

Chat ab **5-layer** model follow karta hai: Channel → Agent → **Orchestrator** (`runTurn`) → Capability Registry → Domain. HTTP/MCP/builtins ek contract pe; policy LLM ke bahar.

**Detail:** [`features/ORCHESTRATOR_LAYER_PLAN.md`](features/ORCHESTRATOR_LAYER_PLAN.md) · `npm run test:orchestrator`

---

## F12 — Human desk (handoff)

### Kyun add kiya?

Kabhi AI jawab nahi de sakta — refund fight, “mujhe banda chahiye”, legal sensitive. Pehle customer **atka** rehta tha; owner ko embed thread ka koi inbox nahi tha.

### Kya improve hua?

- **Embed widget** — “Talk to a human” sirf tab jab customer **explicitly** maange (ya AI resolve na kar sake). Pehle agent try karta hai; doosri dafa insist par desk connect
- **Human desk inbox** (`/inbox`) — waiting queue, filters (Waiting / All / Open / Resolved), search
- **Same thread** — customer embed mein hi human reply (`HUMAN` role); alag app nahi
- **AI pause** — `WAITING_HUMAN` par bot chup; sirf owner reply
- **Waiting UX** — banner “Waiting for human”, typing indicator, 1 min timeout message agar koi reply na ho
- **Owner actions** — human reply, **Return to AI**, **Resolve & close**
- **Internal notes (F12-U U4)** — desk **Note** mode; customer never sees; after Return to AI, bot may use note **facts** (not private judgments) for better replies
- **CSAT (F12-U U5)** — after resolve, embed offers optional **1–5**; Skip ok; desk shows score when rated
- **Handoff limits** — max **3** requests per chat; **30 min cooldown** resolve ke baad dubara request
- **Nav badge** — sidebar par kitne threads wait kar rahe hain
- **Context summary** — handoff par last messages ka text summary (LLM cost nahi)
- **Workspace isolation** — sirf apne workspace ke threads; admin inspect-only (reply nahi)
- **Embed history** — page refresh par **current chat persist**; **24 hours** baad naya chat
- **Chat input** — multiline / scroll par soft corners (ChatGPT-style), extreme pill radius nahi

### Simple examples

| Pehle | Ab |
|-------|-----|
| “Talk to human” pehle message | AI pehle try; button tab; doosri dafa / AI fail → human |
| Owner ko pata nahi kaun wait kar raha | `/inbox` + nav badge |
| Resolve ke baad Resolved tab khali | Return to AI / close dono **Resolved** filter mein dikhte hain |
| Refresh → chat gayab | Same current chat; 24h baad naya chat |

### Demo path (2 browser)

1. Embed par chat → “Talk to a human” ya keyword  
2. Owner login → **Human desk** → thread kholo → reply bhejo  
3. Embed par human message dikhe (poll ~3–8s)  
4. **Return to AI** → customer dubara bot se baat kar sakta hai  

**Tests:** `npm run test:f12` (smoke + live E2E)

**Detail:** [`features/F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md)

---

## F13 — Tools hub (Integrations · MCP · HTTP)

### Kyun add kiya?

F11 actions the, lekin owner ko **Integrations / MCP / HTTP** ek Botpress-jaisi Tools surface chahiye thi — site demo starters, MCP discover, aur HTTP editor alag lanes mein.

### Kya improve hua?

- Customization section **Tools** — tabs: **Integrations · MCP · HTTP**
- **Site demo 6-pack** (`site_demo_v1`) + vertical packs hub (Brandly first)
- **HTTP** list cards + Add HTTP tool dialog (Params · Body · Auth · Headers · Inputs · Timeout)
- **MCP** — demo `/api/demo/mcp`, probe/discover, enable subset; tool loop + kill switch
- Hardening: MCP audit events, per-server rate limits, `ToolRun.mcpToolId`

### Simple examples

| Pehle | Ab |
|-------|-----|
| Connection / Capabilities / Advanced | Integrations / MCP / HTTP |
| MCP nahi | Demo MCP → enable `get_demo_time` → Studio |
| Advanced form long page | Dialog tabs + tool cards |

**Tests:** `npm run test:f13` (t0–t4) · `test:shipped` includes F13  

**Detail:** [`features/F13_TOOLS_HUB.md`](features/F13_TOOLS_HUB.md)

---

## F14 — In-chat action consent (Phase A)

### Kyun add kiya?

WRITE / confirm-gated tools pe model “please confirm” bol sakta tha, lekin embed/studio mein **Confirm button** nahi tha — approval incomplete.

### Kya improve hua?

- Tool loop `CONFIRMATION_REQUIRED` pe **PENDING** `ActionConfirmation` banata hai
- Chat response mein `pendingConfirmations`
- **Confirm / Cancel** card in embed, Test studio, workspace chat
- Approve/deny APIs (`decision`); Approve ke baad auto retry prompt

### Simple examples

| Pehle | Ab |
|-------|-----|
| Policy deny + text only | Confirm button in bubble |
| No deny path | Cancel → DENIED |

**Tests:** `npm run test:f14a`  

**Detail:** [`features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md)

---

## F14-B — Consent evidence model

### Kyun add kiya?

Confirm UI ke baad bhi owner ko durable proof nahi milta tha — kaun ne kab kis args hash pe approve/deny kiya.

### Kya improve hua?

- `ActionConfirmation`: `evidenceId`, `userSubject`, `userDisplay`, `decidedAt`, `decidedIp`
- Approve/deny routes stamp IP + optional subject/display
- `GET /api/agents/[id]/confirmations` + Tools → **Consent evidence** list

### Simple examples

| Pehle | Ab |
|-------|-----|
| PENDING → APPROVED only | + `ev_…` id, subject, IP, decidedAt |
| No owner list | Consent evidence under Tools → HTTP |

**Tests:** `npm run test:f14b` · `npm run test:f14`  

**Detail:** [`features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md)

---

## F14-C — Host user token (`setUser`)

### Kyun add kiya?

Embed visitor signed-in tha site pe, lekin Aide ko subject/token nahi milta tha — identity tools owner admin key use karte ya fail.

### Kya improve hua?

- `aideChat.setUser({ subject, displayName, accessToken })` + `clearUser` + iframe ready handshake
- Public chat: `userSession` body · `Authorization: Bearer` · legacy `identityToken`
- `resolveEndUserIdentity` (HS256 JWT | host session)
- `requiresIdentity` tools → outbound `Authorization: Bearer <end-user>` (owner Bearer overridden)

### Simple examples

| Pehle | Ab |
|-------|-----|
| Embed anonymous only | Host `setUser` after login |
| Identity tool → owner Bearer | End-user access token on identity tools |

**Tests:** `npm run test:f14c` · `npm run test:f14`  

**Detail:** [`features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md)

---

## F14-D — Scoped identity modes + Studio Logs

### Kyun add kiya?

Identity boolean se owner vs visitor token clear nahi tha. Developers ko Test Studio mein yeh bhi nahi dikhta tha ke tool/backend call consume hui ya pehle fail.

### Kya improve hua?

- `AgentAction.identityMode`: `NONE` · `OWNER_KEY` · `END_USER_TOKEN`
- Policy: `END_USER_TOKEN` needs subject **and** access token; never falls back to owner Bearer
- HTTP tool dialog: Identity mode select
- Test Studio left tab **Logs** — session retrieval/tool events + server ToolRun history + plain-language issue lines

### Simple examples

| Pehle | Ab |
|-------|-----|
| Checkbox “requires identity” | Explicit NONE / OWNER_KEY / END_USER_TOKEN |
| Bubble “Called: …” only | Logs tab: why request not consumed |

**Tests:** `npm run test:f14d` · `npm run test:f14`  

**Detail:** [`features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md)

---

## F14-E — Consent hardening

### Kyun add kiya?

Expired Confirm / stale identity sessions abuse risk — approve spam, zombie PENDING rows, opaque tokens without TTL.

### Kya improve hua?

- Identity session TTL (`IDENTITY_SESSION_MAX_TTL_MS` / JWT `exp`) + clear on expiry
- `aideChat.onAuthRefreshNeeded` + iframe `authRefreshRequired`
- Stale PENDING → EXPIRED; approve/deny refuses expired
- Dedicated Confirm rate limits (public + studio)
- Confirm TTL env: `ACTIONS_CONFIRMATION_TTL_MS`

**Tests:** `npm run test:f14e` · `npm run test:f14`  

**Detail:** [`features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md)

---

## Extra — Message like / dislike

### Kyun add kiya?

Thumbs already the — owner ko pata nahi tha **kyun** jawab galat laga, aur DOWN replies ek jagah nahi dikhti thin.

### Kya improve hua?

- Thumbs down ke baad **optional short reason** (~200 chars)
- Agent overview par **Unhelpful replies** — user question + bot jawab + reason → conversation kholo
- Helpful % (UP vs DOWN) usi list ke upar
- Feedback **train nahi** hota private chats par — quality signal hai, knowledge change owner approve kare (baad mein)

### Simple examples

| Pehle | Ab |
|-------|-----|
| Sirf UP/DOWN save | DOWN + optional “wrong price / missing info” |
| Owner ko list nahi | Agent page → Unhelpful replies |

Turn on: **Customization → Message feedback**

---

## Extra — Website re-crawl schedule

### Kyun add kiya?

Pehle site **sirf ek bar** crawl hoti thi jab widget pehli dafa lagta tha. Website update ho to agent purani info use karta rehta tha.

### Kya improve hua?

- **Agent → Knowledge** aur **Customization → Deploy** pe **Website re-crawl schedule**
- Options: once (default) · 24h · 3 days · weekly · monthly
- Interval complete + visitor widget load → crawl dubara queue
- Purani WEB knowledge **update** hoti hai (naya doc nahi duplicate)
- Same origin lock rules — sirf locked site hi crawl
- Site edits live watch nahi hote — schedule + next visitor visit se refresh

### Simple examples

| Pehle | Ab |
|-------|-----|
| Pricing page change → manual delete WEB doc | Weekly schedule → auto refresh |
| “Ek bar hi crawl” default | User khud interval choose kare |

---

## Naye features vs improvements — short list

### Naye features (user-visible)

1. Crawl schedule (Knowledge page)
2. Answer style Short / Detailed / Hybrid (Edit agent)
3. Typo clarify (“Did you ask about …?”)
4. Knowledge sources under test chat replies
5. Crawl status badges on Knowledge page
6. Maintenance screen for users
7. Admin dashboard deep links & filters
8. **Human desk inbox** + embed handoff button / keywords
9. **Human reply** in same embed thread + waiting banner / typing
10. **Handoff limits** (3/chat, 30m cooldown) + inbox filters (Open / Resolved)
11. **Message feedback reasons** + Unhelpful replies on the agent page

### Improvements (peeche / quality)

1. Request id on every API
2. Safe logging (no chat dump)
3. Analytics timeout & SQL aggregates
4. Classify after chat reply (faster feel)
5. Rate limit config centralised
6. Lazy charts & avatar CDN
7. All admin routes gated
8. CI + smoke test suite (`test:shipped`, `test:f12`)
9. Chunk-based knowledge retrieve + fuzzy match
10. Central prompt builder
11. Desk poll intervals + queue soft-cap warning
12. Embed session persist on refresh (new chat after 24h)
13. Chat composer fixed radius on multiline input
14. Dislike reason stored on Message (`feedbackReason` / `feedbackAt`)

---

## Demo ke liye 5 minute checklist

1. Login → agent → TEXT FAQ add → **Test** → sources dikhen  
2. **Edit agent** → Hybrid answer style → short vs long question try karo  
3. **Knowledge** → re-crawl schedule save (optional)  
4. **Customization → Deploy** → embed snippet  
5. **Analytics** → charts load  
6. Admin login → Users filter try karo  
7. **Human desk** — embed handoff → inbox reply → embed par human message  
8. Terminal: `npm run test:shipped` green · `npm run test:f12` · `npm run test:f13`  
9. **Tools** — demo MCP → enable `get_demo_time` → Test studio  

---

## Files (jin par haath lagta hai — short)

| Area | Main files |
|------|------------|
| Errors / logs | `lib/api/error-response.js`, `lib/observability/*` |
| Chat | `lib/services/chat.service.js` |
| Knowledge pick | `lib/services/ai/knowledge-retrieve.js` |
| Prompts | `lib/services/ai/prompt-builder.js` |
| Crawl | `lib/services/embed.service.js`, `lib/services/crawl-schedule.js` |
| **Human desk** | `lib/services/handoff.service.js`, `lib/desk/*`, `components/desk/*`, `app/(app)/inbox/*` |
| Embed handoff | `components/embed/PublicWebchat.jsx`, `lib/embed-history.js` |
| UI | `components/knowledge/KnowledgeList.jsx`, `components/agents/AgentForm.jsx` |
| **Tools hub** | `components/customization/ActionsForm.jsx`, `McpServersPanel.jsx`, `lib/mcp/*`, `lib/services/mcp.service.js` |
| Tests | `scripts/test-f*.mjs`, `npm run test:shipped`, `npm run test:f12`, `npm run test:f13` |

---

*Last updated: Aug 29, 2026 — F01–F14 + F11-U complete · next F00 live DoD + B26 rehearsal.*
