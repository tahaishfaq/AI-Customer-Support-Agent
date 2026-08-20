# Deep audit — Intercom Fin vs Hapy

**Sources (2026-08-20):** [Intercom.com](https://www.intercom.com/), [Fin AI Agent explained](https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained), [Fin FAQs](https://www.intercom.com/help/en/articles/7837535-fin-ai-agent-faqs), [Finetuning retrieval for Fin](https://fin.ai/research/finetuning-retrieval-for-fin/), [Fin AI Engine](https://fin.ai/help/en/articles/13975771-the-fin-ai-engine).  
**Hapy baseline:** studio chat + public embed; knowledge stuffing; classify to analytics; one admin inspect console.  
**Demo / video:** Intercom site CTAs *View demo* / *Start free trial* (gated product demos). Help Center articles + research posts document RAG pipeline in depth. YouTube/Intercom Academy exist as learning channels (not required for this audit).

---

## 1. What Intercom / Fin is selling

Intercom markets itself as **the helpdesk designed for the AI Agent era**, with **Fin** as a natively integrated customer AI agent and **Copilot** as the teammate AI in the Inbox.

Fin claim: high resolution rate across chat/email/voice/social; continuous improvement via content Suggestions and reporting (CX Score, Topics Explorer).

Pricing signal (site): seat + outcome-style packaging (*Intercom with Fin* — seat/mo + per outcome) — enterprise CX economics, not intern MVP.

---

## 2. Architecture (how Fin works)

### 2.1 Three layers (Intercom’s model)

1. **App Layer** — train (knowledge, guidance, connectors), test (simulations, batch tests, preview), deploy (channels, audiences), analyze (dashboards, Suggestions). Flywheel.  
2. **AI Layer** — **RAG**: understand/clarify → search → apply Guidance/policies → generate with hallucination controls; disambiguate when unsure.  
3. **Model Layer** — specialized models: retrieval, reranker, summary, escalation detection, customer-response understanding (trained on support-domain interactions — Intercom’s investment, not customer fine-tune of private chats in the “Never” sense of Hapy policy).

### 2.2 RAG pipeline (research-grade detail)

From Fin research:

1. **Retrieve** ~40 candidates via **semantic search** (embeddings per document/workspace).  
2. **Rerank** to top 5–10.  
3. **Generate** answer with context (user attributes, time, etc.).  
4. Isolation: retrieval scoped to **workspace**; query vectors discarded after search (PII posture).

This is the opposite of Hapy’s current **concatenate all TEXT/PDF/WEB into the system prompt**.

### 2.3 Knowledge base

- Content library: Help Center, internal docs, PDFs, webpages, multi-source generative answers.  
- **Audiences** — different content for plan/location/brand.  
- **Guidance** — policy coaching documents.  
- **Suggestions** — AI proposes content updates from unresolved chats.  
- **Vision** — image/screenshot understanding for support.  
- Tone + answer length controls.

### 2.4 Automations / “agentic” work

- **Fin Tasks** then **Procedures** — multi-step business processes (cancel order, refund) with data connectors and optional code in steps.  
- **Workflows for Fin** — Fin inside Intercom Workflows.  
- **Outbound Fin** — proactive from product analytics (rage click, failed checkout) via FullStory/Pendo-class signals.  
- **Human handoff** with risk filters (self-harm, jailbreak, high-risk advice).

### 2.5 Integrations

- Fin over Intercom Messenger **or** sit on top of other helpdesks (Salesforce, HubSpot, Zendesk story).  
- **Data connectors** for personalized answers and actions.  
- Identity Verification attributes (name, email, locale, current page URL, …).

### 2.6 Chain of thought / response flow

Not always shown as Zendesk’s checklist UI, but engine steps are fixed:

```
Query check / optimize
  → Retrieve (semantic)
  → Rerank
  → Augment prompt + Guidance + attributes
  → LLM generate
  → Certainty / clarification OR escalate
  → Channel-shaped reply (chat vs email structure)
```

**Copilot** (separate): Inbox assistant for humans — drafts, past conversation context — same knowledge plane, different audience.

### 2.7 Roles

Fin for Service / Sales / Ecommerce — one agent switching optimization goals by context (journey-wide CX agent).

---

## 3. Hapy today (same lenses)

| Lens | Intercom Fin | Hapy now |
|------|--------------|----------|
| Knowledge | Semantic RAG + rerank + multi-source library | Stuffing TEXT/PDF/WEB |
| Guidance | First-class policy docs | `systemPrompt` string only |
| Procedures / Tasks | Multi-step actions | None |
| Channels | Chat, email, voice, Slack, Discord, social | Embed webchat + studio |
| Handoff | Rich, risk-aware | None (admin inspect ≠ inbox) |
| Test | Simulations, batch, answer inspection | Studio test + auto question pack |
| Insights | CX Score, Topics Explorer, Optimize | Topic/sentiment + charts (product + admin platform) |
| Personalization | IDV + CDAs + page URL | Anonymous embed + logged-in studio |
| Learning | Suggestions from failures | Classify + optional message feedback |
| Pricing model | Seat + outcomes | Free intern SaaS shape |

Closest Hapy cousin to Fin’s App Layer: **Train (knowledge) → Test (studio) → Deploy (embed) → Analyze (analytics)** — already the product story in demos.

---

## 4. Gap severity

| Capability | Gap | Backlog map |
|------------|-----|-------------|
| Semantic RAG + rerank | Critical for Fin-parity answers | **P3-RAG**; interim **W3-1** |
| Guidance / Procedures | Large | Soft: better prompts (**W3-3**); hard: **P3** procedures |
| Data connectors / actions | Huge | Future tools; not Week 3 |
| Omnichannel | Huge | **P3-CHANNELS** |
| Handoff | Large | **P3-DESK** |
| Simulations / answer inspection | Medium | Studio polish / citations |
| Topics Explorer | Partial win | Hapy already classifies topics — deepen (**W3-6** only if named) |
| Content Suggestions | Medium | Post-analytics content gaps — later |
| Copilot for humans | Large | Desk era |
| Custom LLMs | Out | **P3-LLM** + **Never** private training |

---

## 5. Path to Fin-*class* quality (not Fin clone)

### Near (P1 Week 3 pick 2–3)

1. **W3-1** retrieval stuffing quality (Fin’s “find right info” without vectors yet).  
2. **W3-3** Guidance-like prompt templates (tone, refuse, policy).  
3. **W3-7** messenger polish if demo-critical.  
4. Studio: show **which knowledge docs** were in the stuffed window (Fin “answer inspection” lite).

### Later (P3 reopen)

1. **P3-RAG** — embeddings, workspace-scoped search (mirror Fin research isolation).  
2. **P3-DESK** — escalate with transcript summary.  
3. Procedures as **markdown playbooks** executed with allowlisted HTTP tools (Fin Procedures lite).  
4. Keep **origin-locked crawl** as Hapy differentiator vs Fin’s open content library sprawl.

### Explicit non-goals (internship + Hapy policy)

- Fine-tuning on customer conversations.  
- Cloning Messenger outbound marketing suite.  
- Outcome-based billing (**P3-BILLING**).

---

## 6. What Hapy already beats Fin on (niche)

- **Origin lock + one-time site crawl** tied to embed key (Fin learns from many sources; Hapy binds widget to one live site).  
- **Workspace hard isolation** for agents (Fin is workspace-aware; Hapy’s switch-workspace 404 is a sharp tenancy demo).  
- **Platform admin** that 404s for users — separate trust plane without Intercom-scale org.

---

## 7. Verdict

Fin = **RAG + Guidance + Procedures + omnichannel flywheel** with specialized models.  
Hapy = **App-layer skeleton of Fin** (train/test/deploy/analyze) with a **thin AI layer** (stuffing + one LLM).

Architectural climb: **make the AI layer Fin-shaped (retrieve → ground → clarify → escalate)** while staying inside [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) bands.

**Related:** [`FUSION_PLAN_HAPY_UNIQUE.md`](FUSION_PLAN_HAPY_UNIQUE.md).
