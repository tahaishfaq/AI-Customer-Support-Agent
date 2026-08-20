# Deep audit — Zendesk AI Agents vs Hapy

**Sources (2026-08-20):** [Zendesk.com](https://www.zendesk.com/), [AI Agents product](https://www.zendesk.com/service/ai/ai-agents/), [Resolution Platform / agentic AI blogs](https://www.zendesk.com/blog/zendesk-insights/innovation/enter-your-resolution-era-with-zendesks-agentic-ai/), [What are AI agents](https://www.zendesk.com/blog/ai/workflow-automation/what-are-ai-agents/).  
**Hapy baseline:** Phases 0–11 + Admin A0–A6; chat = prompt-stuff knowledge + OpenAI + post-chat classify (`lib/services/chat.service.js`).  
**Demo / video:** Zendesk homepage “View demo” + **AI Masterclass 2026** on-demand workshops (not a single public YouTube walkthrough of the full agent stack — sales/demo gated). Product page shows an interactive **chain-of-thought** mock (search knowledge → retrieve order → verify eligibility → confirm items).

---

## 1. What Zendesk is selling

Zendesk is **not** “a chatbot builder.” It is an **AI-first helpdesk / Resolution Platform**: tickets, messaging, voice, knowledge, QA, workforce, Copilot for humans, and **autonomous AI agents** that plan + act across systems.

Positioning: *self-improving AI agents built for resolution*, connected to business systems, governed by a **Resolution Learning Loop**.

---

## 2. Architecture (how agents work)

### 2.1 Agentic loop (public model)

From Zendesk’s own AI-agent explainer:

1. **Perceive** — capture request across channels; detect intent / urgency / context.  
2. **Reason & plan** — LLM + procedures/rules; break multi-step goals.  
3. **Act** — call tools/APIs (orders, billing, CRM, ticketing fields).  
4. **Observe & adapt** — if outcome incomplete, replan; else close.  
5. **Learn** — Resolution Learning Loop stores outcomes under governance (not raw “train on all private chats” as a free-for-all).

This is **agentic AI**, not FAQ Q&A only.

### 2.2 Multi-agent orchestration (behind one chat)

Marketing / engineering narrative: specialized sub-agents collaborate (intent, conversational RAG, procedure/compliance, action execution, QA/tone). Customer sees one conversation; system runs a **team of specialists**.

UI demo on AI Agents page shows explicit **chain of thought** steps for a return:

- Search knowledge  
- Retrieve order details  
- Verify return eligibility  
- Verify item selection  

Plus **rich response cards** (selectable products) — not plain text only.

### 2.3 Knowledge base

- Connected **Knowledge** product: Help Center, articles, connectors (e.g. Confluence/Guru-class sources in Resolution Platform story).  
- **Conversational RAG** agent retrieves policies; can ask clarifying questions (e.g. location for payment options).  
- Knowledge Builder / Knowledge Copilot: gap detection, article drafting — content ops flywheel.

### 2.4 Automations

- Ticketing automations, SLA, routing, triggers (classic Zendesk + AI-enhanced).  
- No-code automations for escalation, assignment.  
- AI agents consume **procedures / business rules** as guardrails for actions (refunds, identity checks).

### 2.5 Integrations

- Marketplace: **1,800+** apps.  
- Actions & integrations layer: unify data; drive resolution in billing/order/identity systems.  
- Omnichannel: chat, email, voice, social → one service surface.

### 2.6 LLM working

- Zendesk does **not** expose “pick GPT and stuff a PDF” as the product.  
- LLM is the **reasoning engine** inside a platform with RAG, tools, governance, QA scoring.  
- Copilot = **human-assist** AI in the agent workspace (drafts, next steps, knowledge surfacing) — separate from customer-facing AI agents.

### 2.7 Response flow (customer path)

```
Channel message
  → Intent / triage agent
  → RAG / clarify
  → Procedure check
  → Tool actions (order, refund, update)
  → Structured UI reply (cards / forms) OR handoff to human with context
  → Ticket update + learning loop signal
```

---

## 3. Hapy today (same lenses)

| Lens | Zendesk | Hapy now |
|------|---------|----------|
| Product shape | Full helpdesk + AI workforce | Workspace agent studio + embed + insights |
| Knowledge | Multi-source RAG + connectors + content ops | TEXT / PDF / one-time WEB origin crawl; **prompt stuffing** (~12k chars) |
| Automations | Ticket rules, SLA, agent procedures | Rate limits, platform settings, embed kill — **no procedure engine** |
| Integrations | Marketplace + actions into CRM/billing | Cloudinary, OpenAI, Google auth — **no action tools** |
| Chain of thought | Visible multi-step plan + tools | Single `chatCompletion` call; no tool loop |
| Response flow | Multi-step + rich UI + handoff | USER msg → LLM → ASSISTANT → classify topic/sentiment |
| LLM | Platform-orchestrated + RAG + tools | One OpenAI chat model (+ classify call) |
| Channels | Omnichannel | Webchat embed + studio only |
| Learning | Resolution Learning Loop + QA | Classify + analytics; message feedback field exists |
| Humans | Copilot + inbox + WFM | Admin **inspect** only (no customer desk) |

Hapy’s strength vs Zendesk: **simplicity, ownership of knowledge, workspace isolation, origin-locked embed, operator admin without impersonation.**  
Hapy’s gap: **cannot “resolve”** (refund, update order) — only **answer**.

---

## 4. Gap severity (what “their level” means)

| Capability | Gap size | Maps to Hapy backlog |
|------------|----------|----------------------|
| Vector / conversational RAG | Large | **P3-RAG**; soft start **W3-1** stuffing |
| Tool / actions (orders, CRM) | Huge | New — treat as future **P3-ACTIONS** (not opened) |
| Multi-agent CoT UI | Large | Product-extras / research; not Week 3 |
| Ticketing + SLA automations | Huge | Adjacent to **P3-DESK** |
| Omnichannel | Huge | **P3-CHANNELS** |
| Human Copilot | Large | **P3-DESK** + optional Copilot later |
| Marketplace integrations | Huge | Never clone; selective OAuth later |
| Learning loop / QA scoring | Medium | Extend classify + feedback; not train on private data (**Never**) |
| Rich card responses | Medium | Embed customization extras |

---

## 5. How Hapy can approach Zendesk-level *architecture* without becoming Zendesk

### Phase A — Week 3 / P1 (allowed, no horizontal explosion)

1. **W3-1** — smarter stuffing (keyword/recency/token budget + cite doc titles in prompt).  
2. **W3-3** — stronger grounding prompts + classify quality.  
3. **W3-4** — request-id logging for failed resolutions.  
4. Optional: surface **assistant “sources used”** titles in studio (citation lite — still stuffing).

### Phase B — Named P3 when file is reopened

1. **P3-RAG** — embeddings + retrieve top-k (Zendesk “Conversational RAG” slice).  
2. **P3-DESK** — handoff status WAITING_HUMAN (Zendesk handoff slice, tiny).  
3. Future **actions**: allowlisted tools per agent (e.g. `lookup_order` webhook) — Zendesk “Act” without Marketplace.  
4. **Never:** train models on private customer conversations.

### What *not* to copy

- Workforce management, contact center, 1800-app marketplace, multi-agent marketing theater as Day-1 UI.  
- Resolution Learning Loop that implies training on customer data.

---

## 6. Success metrics if chasing Zendesk-like *outcomes*

| Metric | Zendesk-class | Hapy-realistic target |
|--------|---------------|------------------------|
| Autonomous resolution | High % with tools | N/A until actions exist; measure **deflection** (answered without human) |
| Hallucination | Low via RAG + checks | Refuse-when-unsure + citations |
| Multi-step tasks | Returns/refunds | Documented “answer-only” until tools |
| Insights | Enterprise CX score | Topic/sentiment you already ship |

---

## 7. Verdict

Zendesk = **resolution OS** (plan → retrieve → act → learn) inside a helpdesk.  
Hapy = **knowledge-grounded support agent + insights + embed lock + admin inspect**.

To reach *architectural* parity on the AI path: **RAG → tools → guarded procedures → handoff**, in that order, mapped to **W3-1 then P3-RAG then desk/actions** — not a Zendesk clone.

**Related:** fusion roadmap in [`FUSION_PLAN_HAPY_UNIQUE.md`](FUSION_PLAN_HAPY_UNIQUE.md).
