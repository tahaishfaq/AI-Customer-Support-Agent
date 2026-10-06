# Aide competitive deep audit

Line-by-line gaps vs **Intercom Fin**, **Decagon**, **Sierra**, and **Zendesk AI** — crawl → knowledge → web → HTTP tools → MCP → streaming/speed.

**Evidence:** Aide code (Stage 6 freeze + Level 3 L1–L8) and public competitor product docs (2025–2026).  
**Date:** 2026-10-05  
**Related plan:** [LEVEL_3_ADVANCED_PLAN.md](LEVEL_3_ADVANCED_PLAN.md) · Trust path: [ARCHITECTURE_FREEZE_STAGE6.md](../ARCHITECTURE_FREEZE_STAGE6.md)

---

## Bottom line

Aide already matches leaders on **safety architecture** and has Level 3 building blocks (hybrid RAG, procedures, Auto-QA, sim, A/B). The demo gap is **freshness + meaning-first retrieve by default + connector depth + first-token feel** — not “add another LLM.”

| Signal | Focus |
|---|---|
| Keep | Confirm / fence / SSRF |
| P0 | Retrieve + TTFT + crawl tick |
| P1 | Connectors + MIXED web UX |
| P2 | Voice / WhatsApp / SSO |

---

## Scorecard

| Surface | Aide today | Fin / Decagon / Sierra / Zendesk | Gap | Priority |
|---|---|---|---|---|
| Crawl | HTTPS origin · 100 pages / 4 hops · opt-in SPA browser (25) · recrawl on ping/enqueue | Continuous sync, robots budget UX, delta crawl, private HC connectors | Large | P0 |
| Knowledge | Lexical default · opt-in hybrid RAG (pgvector + RRF) · 12k budget · suggestions need approve | Retrieve→rerank→generate · multi-source fuse · audiences · contradiction detect | Medium | P0 |
| Web search | Dual gate + OpenAI Responses · WEB/MIXED · no empty-KB auto-web · 12s timeout | Domain allowlists, site-scoped search, citation SLAs, lower MIXED latency | Medium | P1 |
| HTTP tools | GET/POST · SSRF · confirm · idempotency · 8s/15s · 3 steps / 25s loop | 100+ deep connectors, PUT/PATCH, marketplace, CRM writebacks | Large | P1 |
| MCP | Remote HTTP/SSE · GitHub OAuth · same PEP as HTTP · optional semantic shortlist | Broader OAuth, Fin-as-MCP, rich arg UX, stdio/local for builders | Medium | P1 |
| Streaming | NDJSON token deltas · 2KB flush pad · tool rounds clear draft · MIXED store not streamed | TTFT polish, continuous status, mid-turn resume, voice endpointing | Medium | P0 |
| Procedures | JSON procedures + step builder · first-match · tool/handoff with policy | Doc-style AOPs, code+connectors in steps, Duet/Ghostwriter builders | Medium | P1 |
| QA / sim / A/B | Auto-QA sample · simulation dry-run · A/B buckets (no auto-promote) | Batch import sims, live traffic experiments, Watchtower-style 100% review | Medium | P1 |
| Channels | Embed + email inbound · WhatsApp deferred · no voice | Chat, email, voice, Slack, Discord, helpdesk-native | Large | P2 |
| Trust path | DATA≠AUTHORITY · fence · confirm · SSRF · source strip — strongest moat | Similar enterprise guards; often less explicit in product docs | Aide ahead | Keep |

---

## 1 · Crawl — line-by-line

**Today:** `site-crawler` HTTPS, 100 pages / 4 hops, 8s fetch, optional browser 25 pages, recrawl intervals 0/24/72/168/720h via embed ping / enqueue.

| # | Improvement | Why vs leaders | Effort |
|---|---|---|---|
| 1 | True cron/BullMQ tick for due recrawls (not only embed ping) | Leaders keep HC fresh without traffic; Aide can go stale if embed quiet | S |
| 2 | Delta crawl: ETag / Last-Modified / contentHash skip unchanged pages | Cuts cost/latency on 72h–weekly schedules | M |
| 3 | Sitemap priority + path allow/deny UI (`docs/`, `/help`, exclude `/blog`) | Fin content library targets; shallow 100-page crawl wastes budget on marketing | S |
| 4 | Raise browser path quality: login-wall detect, render wait selectors | SPA help centers fail silently without browser or look empty | M |
| 5 | Per-page freshness badge in Knowledge UI + “stale since” | Owners can’t see crawl debt; Zendesk/Fin surface content freshness | S |

---

## 2 · Knowledge base — line-by-line

**Today:** `selectKnowledgeChunks` + optional `selectKnowledgeHybrid` (RRF), 12k chars, 12 packed chunks, embeddings `text-embedding-3-small`, suggestions owner-approve only.

| # | Improvement | Why vs leaders | Effort |
|---|---|---|---|
| 1 | Default hybrid ON for new agents when OpenAI key present (keep keyword fallback) | Leaders ship meaning-first; Aide hides RAG behind a flag → buyers compare poorly | S |
| 2 | Add cheap cross-encoder / LLM rerank top-20 → top-6 before pack | Fin’s explicit retrieve→rerank→generate; RRF alone loses on near-miss docs | M |
| 3 | Chunk-level citations in Studio + embed “Learn more” (stable chunk ids) | Answer inspection is a Fin selling point; Aide mostly doc titles | M |
| 4 | Connectors: Notion / Confluence / Google Drive / Zendesk HC import | Zendesk lists static connectors; crawl-only loses enterprise RFPs | L |
| 5 | Audience/segment knowledge (plan tier, locale) on retrieve filter | Fin Audiences; wrong-plan answers are a top support failure mode | M |
| 6 | Suggestion loop: one-click publish + learn from dismiss (conflict flag exists) | Fin Suggestions + Zendesk Knowledge Builder close the flywheel faster | S |

---

## 3 · Web search — line-by-line

| # | Improvement | Why vs leaders | Effort |
|---|---|---|---|
| 1 | Domain allowlist / denylist per agent for hosted `web_search` | Stops competitor/pricing hallucination from open web | S |
| 2 | Stream MIXED store preflight (or skip loop when KB hit score high) | MIXED today = store loop + search → feels slow vs Fin single path | M |
| 3 | Router: embedding/classifier instead of only regex for WEB vs STORE | Misspell / hybrid intents mis-route (`source-policy` heuristics) | M |
| 4 | Force citation coverage check before final answer on WEB route | Leaders market grounded online answers; parse alone is weak SLA | S |

---

## 4 · HTTP tools — line-by-line

| # | Improvement | Why vs leaders | Effort |
|---|---|---|---|
| 1 | Managed connector packs: Shopify, Stripe, HubSpot, Zendesk ticket write | Decagon ~100 deep APIs; hand-authored HTTP templates don’t win demos | L |
| 2 | Optional PUT/PATCH with same confirm+idempotency path | Real CRM updates often aren’t POST-only | M |
| 3 | OpenAPI import polish + arg form generator in Studio | Sierra SDK / Fin data connectors reduce owner engineering | M |
| 4 | Redis-global outbound rate limits (instance Map under-counts) | Multi-replica prod can exceed intended 30/min | S |

---

## 5 · MCP — line-by-line

| # | Improvement | Why vs leaders | Effort |
|---|---|---|---|
| 1 | Generic OAuth2 / API-key vault for arbitrary MCP servers (not only GitHub) | Fin MCP + Sierra MCP story is broader than one OAuth path | L |
| 2 | Default-on `semanticToolShortlist` when tool count > 12 | 3-step / 25s budget dies when model sees 40 tools | S |
| 3 | Arg schema UI + dry-run probe with sample payloads | Owners can’t validate MCP tools before go-live | M |
| 4 | Expose Aide as MCP (Fin Agent API pattern) for product copilots | Inbound MCP makes Aide the support brain for other agents | L |

---

## 6 · Streaming & speed — how to fine-tune feel

**Do not raise frozen caps** (3 tools / 25s / 12k KB) to “feel faster.” That trades abuse surface for latency theater. Win TTFT and path selection instead.

| Phase | Current behavior | Fine-tune | Expected win |
|---|---|---|---|
| TTFT (first token) | Wait on auth + KB select + source route before first delta | Emit status immediately; parallel KB embed with history; skip KB on greeting (already) | 200–800ms perceived |
| Knowledge select | Hybrid query embed budget 1.5s; can block turn | Race lexical vs vector; stream “Checking knowledge”; cache query embeds 60s | 300–1500ms |
| Tool rounds | Draft cleared on tool call (`replace ""`) — UI jump | Keep last draft + activity chip; don’t blank transcript | UX continuity |
| MIXED web | Non-streaming store preflight then Responses search | Stream both legs or single Responses call with store facts in system | 1–3s + smoother |
| Model choice | Default chat model may be heavier than needed for FAQ | Route FAQ/STORE → gpt-4.1-mini / nano; escalate on low KB score | TTFT + $/turn |
| Proxy buffering | 2KB flush pad already in `createChatServerStream` | Keep pad; ensure CDN doesn’t buffer; measure p50 TTFT in Studio | Stable on coral |
| Resume | No mid-stream reconnect; new POST only | Optional `turnId` resume for last N deltas (hard; P2) | Mobile reliability |
| Caps (keep) | 3 tools / 25s / 12k KB — freeze | Don’t raise caps without abuse evidence; shortlist + faster retrieve | Safety + predictability |

### Token-by-token checklist (implement in order)

1. Wire `status` event at request accept (before Prisma history).
2. Parallel: load history ‖ list knowledge docs ‖ resolve source route.
3. Lexical-first paint: start model with lexical pack; splice hybrid if ready &lt;800ms.
4. Prefer `chatCompletionStreamTurn` deltas; never buffer full answer server-side.
5. On `tool_calls`: keep visible draft + activity; clear only if policy requires rewrite.
6. Studio timing strip: `knowledgeSelectMs` / `llmTtftMs` / `toolMs` (`turn-context` already has timings).
7. Prod: measure p50/p95 TTFT on coral; alert if p95 &gt; 2.5s STORE FAQ.

---

## Gaps found from testing / code review

| Finding | Evidence | Fix |
|---|---|---|
| Semantic RAG off by default → demo agents look “dumb keyword” vs Fin | `Agent.semanticRagEnabled` default false; hybrid only when enabled | Onboarding toggle “Smart retrieve” ON when key present |
| Crawl freshness depends on traffic (ping/enqueue) | `isRecrawlDue` gated on enqueue paths; no dedicated schedule worker tick | BullMQ repeatable job per agent schedule |
| MIXED path feels 2× slow in Studio vs STORE | `loop.js` store preflight then `responsesStreamTurn` | Stream status + collapse path when KB confidence high |
| Simulation exists but no batch import from inbox / CSAT fails | `SimulationPanel` `questionsText` only; Fin batch testing | Import last N unanswered + failed CSAT into sim suite |
| A/B never auto-promotes (correct) but thin winner metrics | `AbExperimentPanel` samplesA/B + minSample cue | Show CSAT/resolution by bucket; one-click restore version |
| Privacy/QA dialogs API-fast but UI “Loading…” lag | Local browser audit Oct 2026 | Suspense skeleton + prefetch on Inbox mount |
| WhatsApp / Voice / SSO still deferred vs every leader pitch deck | LEVEL_3 deferred A6/A9; M7 WhatsApp | Sell embed+email hard; roadmaps Voice/WhatsApp as paid packs |
| Trust/confirm is a sales advantage — don’t weaken for speed | `ARCHITECTURE_FREEZE_STAGE6` DATA≠AUTHORITY | Market “safe actions” vs Fin/Decagon confirm UX |

---

## What Aide should sell harder (already ahead)

### Safety product

Confirm + one-shot consume, write idempotency, SSRF, untrusted fences, source strip, no empty-KB→web. Leaders bury this; Aide can lead with “won’t invent authority.”

### Owner control surface

Studio, version restore, guidance, procedures builder, desk+copilot, resolution metrics, email inbound, Level 3 toggles off-until-configured.

---

## 90-day roadmap

| When | Focus |
|---|---|
| **Week 1–2 · Feel faster** | Hybrid default · TTFT status · don’t blank on tools · query-embed cache · domain allowlist web · crawl cron tick |
| **Week 3–5 · Win retrieve demos** | Rerank top-k · chunk citations · sitemap allowlist · delta crawl · suggestion one-click · MIXED stream fix |
| **Month 2 · Win enterprise RFPs** | Notion/Confluence/Drive connectors · Shopify/Stripe packs · generic MCP OAuth · audience KB · batch sims |
| **Month 3+ · Channels & ops** | WhatsApp pack · Voice spike · Aide-as-MCP · Redis global RL · resolution invoice line |

---

## Final verdict

### vs Fin

Fin wins content library, multilingual, vision, voice, and retrieve→rerank polish. Aide matches on procedures/sim/A/B skeleton and beats on explicit tool safety. Close the demo by defaulting hybrid RAG + citations + crawl cron.

### vs Decagon / Sierra

They win deep connectors, AOPs/Studio polish, and enterprise services. Aide wins self-serve + open trust path. Prioritize Shopify/Stripe/HC connectors before Voice.

### vs Zendesk AI

Zendesk wins native ticket gravity and HC connectors. Aide wins embed-first product teams who don’t want Zendesk lock-in — double down on embed + email + safe actions.

---

## Recommended next build (highest ROI)

1. Hybrid RAG default + Studio timing  
2. Crawl schedule worker tick + delta hash  
3. Don’t blank stream on tools + MIXED path stream  
4. Web domain allowlist  
5. One managed HTTP pack (Stripe or Shopify)

That package moves Aide from “Level 3 shipped but quiet” to “feels like Fin in a buyer demo” without breaking the freeze.

---

## Caps reference (do not casually raise)

| Cap | Value |
|---|---|
| `MAX_TOOL_STEPS` | 3 |
| `TOOL_LOOP_DEADLINE_MS` | 25_000 |
| Knowledge budget | 12_000 chars |
| HTTP timeout | 8s default / 15s max |
| Web search timeout | 12_000 ms |
| History | 20 messages |
| Stream transport | NDJSON (not SSE) |

**Authority:** [`ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md) · [`LEVEL_3_ADVANCED_PLAN.md`](LEVEL_3_ADVANCED_PLAN.md) · shipped catalog: [`LEVEL_3_ADVANCED.md`](../shipped/LEVEL_3_ADVANCED.md)
