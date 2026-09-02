# F10 — Semantic RAG (later — P3)

**Status:** **Not the default next.** After F00 / F11-U live, prefer **M01 MCP** before F10 unless KB pain is real. Open F10 only when [`ROADMAP_NEXT.md`](../ROADMAP_NEXT.md) §2/§3 says so **or** an agent hits the F08 soft threshold below.  
**Goal:** Fin-grade **retrieve → (optional) rerank → generate** with citations — meaning-based chunk pick, not only keyword overlap.  
**Maps to:** internship OOS vector DB · P3-RAG · Fusion Band 3 item 1 · product **P-O6**.  
**Prerequisite:** F08 (lexical stuffing) + F09 (prompts) shipped — F10 **extends** retrieve, does not replace grounding rules.  
**O01 sync (Aug 31, 2026):** Knowledge retrieve stays **Agent-layer** (prompt stuffing), **not** an Orchestrator capability/tool. F10 changes `knowledge-retrieve` / embeddings only — **do not** wrap RAG as a chat tool unless product explicitly decides later.

> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test**. Until then, keep plan lines + the decision sections below.

---

## Why add this feature *at this time*? (decision guide)

F10 is **not** “Week 3 must-ship.” Open it when **product pain** matches, not because the file exists.

### Good reasons to open F10 now

| Signal | Why F10 helps |
|--------|----------------|
| Agent has **> ~40 knowledge docs** OR **> ~80k** total chars (F08 soft threshold) | Lexical packing + fuzzy still miss paraphrases; char budget truncates the right chunk |
| Users ask in **different words** than the FAQ (“money back” vs “refund policy”) and F08 fuzzy/clarify is not enough | Embeddings match **meaning**, not spelling/edit-distance alone |
| Demo / internship DoD wants **vector / RAG** as a named stretch | Internship listed RAG/embeddings as advanced OOS — F10 is the clean story |
| Competitors (Fin-style) sell “retrieve then answer with cites” | F08 is retrieve-lite; F10 is the real climb |

### Bad reasons to open F10 now

| Temptation | Better move instead |
|------------|---------------------|
| “We finished F09, next number is F10” | Ship buffer polish, demo, or **F11/F12** if those win demos |
| Small KB (few FAQs) already answers well | Stay on F08 + F09 — lower cost, simpler ops |
| Want better tone / refuse only | Already F09 — no vectors needed |
| Want agent to **do** things (lookup order, create ticket) | That is **F11 Actions**, not RAG |
| Want human escalate | That is **F12 Desk**, not RAG |

### Soft open threshold (from F08)

Documented in F08 / `knowledge-retrieve.js`:

- **`F10_DOC_THRESHOLD` ≈ 40** knowledge docs, **or**
- **`F10_CHARS_THRESHOLD` ≈ 80_000** total knowledge characters  

Until then, F08 lexical + fuzzy + F09 prompts is the supported path.

---

## Why *semantic* RAG instead of “simple RAG”?

People say “RAG” for many things. Aide already has a **simple retrieve-then-generate** path — that is **F08**.

| | **Simple RAG (what we have = F08)** | **Semantic RAG (F10)** |
|---|-------------------------------------|-------------------------|
| **How retrieve works** | Lexical: tokenize, overlap score, fuzzy/typo, pack under ~12k chars | Embed chunks + query → nearest neighbors in vector space (meaning) |
| **Infra** | In-process JS only — no index table, no embedding API | Embeddings API + store (Neon **pgvector** *or* Pinecone/Qdrant) |
| **Cost / latency** | Cheap; no extra embed call per ingest/query | Embed on upload + embed per query; rate limits; storage |
| **Wins at** | Exact keywords, typos (`reunf`→refund), small–medium KB | Paraphrase, synonym, long multi-doc corpora |
| **Fails at** | “How do I get my money back?” when doc only says “refund policy” and tokens barely overlap | Needs ops: backfill, rebuild on doc update, fallback when embed API is down |
| **Aide identity** | Answer-from-knowledge + cite titles — already | Same grounding (F09); better **which** chunks enter the prompt |

### “Simple RAG” is *not* “no RAG”

```
User question
    → F08 select chunks (keywords / fuzzy)
    → F09 system prompt + rules
    → LLM generate
    → cite usedKnowledge titles
```

That **is** retrieve-augmented generation — just **lexical**, not **semantic**.

### Why we choose semantic (when we open F10) rather than only “more stuffing”

| Approach | Why not enough alone |
|----------|----------------------|
| Raise `KNOWLEDGE_MAX_CHARS` forever | Burns tokens, still wrong order; noise in prompt |
| Bigger fuzzy / Soundex only | Still no true paraphrase / cross-language meaning |
| Extra LLM re-rank of all docs | Cost + latency every turn; F08 banned this |
| **Semantic top-k** | One embed query → few best chunks → same F09 generate path |

**F10 plan is hybrid by design (Phase C):** keep F08 lexical as **fallback** and optionally **blend** scores so embed outage does not break chat.

---

## If you do **not** ship F10 — what to do next (VIMP)

Roadmap rule: **do not merge F10–F12 until P3 is explicitly reopened** — but you can **prioritize which P3 ID opens first**, or stay in **buffer** (already-shipped polish).

### Recommended order if skipping F10 for now

| Priority | Option | Why it’s VIMP / “next” | File |
|----------|--------|------------------------|------|
| **1 — Demo / DoD buffer** | Live Vercel smoke, README/demo script, admin password login verify, UI polish | Internship **Done when** + stable demo beats unfinished RAG | F04 polish · F03 CI · README |
| **2 — Product “wow” without vectors** | **Agent actions** — allowlisted HTTP tools (order status, CRM ping) | Zendesk/Botpress “agent *acts*” story; users feel power beyond Q&A | [`F11_AGENT_ACTIONS.md`](F11_AGENT_ACTIONS.md) |
| **3 — Support ops** | **Human desk handoff** — WAITING_HUMAN inbox in workspace | Real support teams need escalate when AI is stuck | [`F12_HUMAN_DESK.md`](F12_HUMAN_DESK.md) |
| **4 — Open F10** | Semantic RAG when KB size / paraphrase pain is real | Best answer quality for large knowledge | **This file** |
| **Defer hard** | Billing, teams RBAC, flow canvas, open-web crawl, fine-tune, SSO | Internship ❌ / Never / huge scope | [`POST_MVP_BACKLOG_PLAN.md`](../POST_MVP_BACKLOG_PLAN.md) P3-* |

### Quick pick guide

| Your goal | Skip F10 → do this |
|-----------|---------------------|
| Internship demo next week | Buffer + F03/F04 polish — **not** F10 |
| “Bot can call our API” | **F11** |
| “Human takes over chat” | **F12** |
| “Huge FAQ / wrong chunks” | **F10** (reopen P3-RAG) |
| Money / Stripe | **P3-BILLING** — only if product insists |

### Steal vs protect (still)

- **Steal:** Fin retrieve → answer → cite (semantic).  
- **Protect:** no train on private chats; no open-web competitor crawl; no flow-canvas clone as MVP.

---

## Phase A — Scope & identity

- In: embeddings on knowledge upload, top-k semantic search, optional rerank, citation UI, workspace isolation of vectors.
- Out: training on private chats; open-web scrape console; multi-provider model garden; replacing F09 grounding rules.

### Identity guardrails (when opened)

| Keep | Meaning |
|------|---------|
| Workspace / agent isolation | Vectors never cross workspace or agent |
| Answer-from-knowledge | F09 rules stay; RAG only chooses chunks |
| Cite titles | Studio `usedKnowledge` / cites from retrieved chunks |
| Fallback | Embed down → F08 lexical (no silent invent) |

## Phase B — Design & functionality

- Chunk + embed on TEXT/PDF/WEB ingest.
- Query embed → top-k → (optional) rerank → prompt with cites.
- Studio + analytics: citation ids.

## Phase C — Improvements

- Hybrid lexical (F08) + vector.
- Stale embed rebuild job when doc updates.

## Phase D — Error handling

- Embed provider down → fall back to F08 stuffing + warn.
- Empty index → refuse path.

## Phase E — Production bottlenecks

- Batch embeds; rate-limit OpenAI embedding TPS.
- Cap top-k and context tokens.

## Phase F — Scaling

- pgvector on Neon **or** external store — choose one in Phase G.
- Per-workspace index namespace.

## Phase G — Infrastructure

- Decide: Neon pgvector vs Pinecone/Qdrant.
- Migration + backfill plan; cost alerts.

## Phase H — Production testing

- [ ] Isolation: workspace A vectors never hit workspace B.
- [ ] Cite ≥1 title on grounded answers.
- [ ] Fallback when embed API fails.
- [ ] Paraphrase query still retrieves correct FAQ vs F08-only baseline.

## Done when (future)

Grounding rate metric from Fusion §9 improves vs F08-only baseline.

---

## How to implement (simple step-by-step)

Use this when P3 reopens and an agent hits the F08 size threshold (~40 docs or ~80k chars). Keep language and steps easy — no new product modules until pain is real.

### Step 1 — Pick vector storage (one choice)

| Option | Good for | Trade-off |
|--------|----------|-----------|
| **Neon pgvector** | Same Postgres as Prisma — fewer moving parts | Migration + SQL for similarity search |
| **Pinecone / Qdrant** | Managed vector SaaS | Extra bill + sync job; simpler at huge scale |

**Recommendation for Aide:** start with **Neon pgvector** so workspace/agent isolation stays in one DB.

### Step 2 — Database tables

Add roughly:

- `KnowledgeChunk` — `id`, `documentId`, `agentId`, `content` (text), `tokenEstimate`, `embedding` (vector), `createdAt`
- Index: `(agentId)` + vector index on `embedding`

On **TEXT / PDF / WEB upload or crawl finish**: split doc into ~500–800 token chunks (same redaction rules as crawl), embed each chunk, upsert rows. Delete old chunks when doc is replaced.

### Step 3 — Embedding service

New file `lib/services/ai/embeddings.js`:

1. Call OpenAI `text-embedding-3-small` (or similar) with timeout + `maxRetries: 0` (same as chat).
2. Batch up to N chunks per request to save cost.
3. On failure → log safe meta only; **do not** block upload — mark doc `embedStatus: PENDING` for retry job.

### Step 4 — Query path (hybrid with F08)

In `knowledge-retrieve.js` (or sibling `semantic-retrieve.js`):

```
User message
  → embed query (1 API call)
  → top-k chunks by cosine similarity (k ≈ 6–10)
  → merge with F08 lexical top chunks (optional weighted blend)
  → dedupe by documentId
  → pack under KNOWLEDGE_MAX_CHARS (~12k)
  → pass to buildChatSystemPrompt (F09) unchanged
```

**Fallback:** if embed API fails → use **F08 only** (current behavior). User still gets an answer; logs show `SEMANTIC_FALLBACK`.

### Step 5 — Citations (UI)

- API already returns `usedKnowledge` titles from F08 — extend to include chunk `documentId` / title from semantic hits.
- Studio test panel: show “Sources” list under assistant bubble (same as F05 pattern).

### Step 6 — Backfill job

One-off script `scripts/backfill-embeddings.mjs`:

- Loop agents with `KnowledgeDocument` rows missing chunks.
- Rate-limit (e.g. 10 docs/min) to protect OpenAI TPS.
- Safe to re-run (idempotent upsert).

### Step 7 — Tests (before ship)

- [ ] Workspace A query never retrieves workspace B vectors.
- [ ] Paraphrase question (“money back”) hits refund chunk when literal F08 miss.
- [ ] Embed API mocked down → chat 200 + F08 fallback.
- [ ] Doc update → old chunks removed, new embeds written.

### Step 8 — When **not** to build this

- KB &lt; ~40 docs and answers already good → stay F08 + F09.
- Need “bot calls API” → **F11** first.
- Need human takeover → **F12** first.

## Steal (not clone)

Intercom Fin **retrieve → rerank → generate + cites** — not their full Suggestions / Guidance CMS product.
