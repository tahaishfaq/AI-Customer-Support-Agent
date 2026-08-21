# Deep audit — Botpress vs Hapy

**Sources (2026-08-20):** [Botpress.com](https://botpress.com/), [Botpress Engine / LLMz](https://botpress.com/features/engine), [How Botpress interfaces with LLMs](https://botpress.com/blog/botpress-interfaces-llms), [Autonomous Node docs](https://www.botpress.com/docs/studio/concepts/nodes/autonomous-node), existing repo note [`BOTPRESS_GAP_PLAN.md`](BOTPRESS_GAP_PLAN.md).  
**Hapy baseline:** Agent Studio tabs (Overview/Knowledge/Test/Customization), embed.js webchat, no flow canvas.  
**Demo / video:** Site footer **Videos**; homepage interactive tour (Build → Resolve → Escalate → Improve). Studio is best understood via product login / docs, not a single ungated full-length public demo.

---

## 1. What Botpress is selling

Botpress positions as **AI-native customer service / agent platform** (and increasingly helpdesk-adjacent): build agents that **act** (refunds, account updates, multi-step workflows), escalate hot to humans, and **learn** so the same problem is not solved twice.

Tagline energy: *Your AI answers. Ours acts.*  
Pricing narrative: **no per-seat**; usage-oriented (contrast Intercom seat+outcome).

Hapy historically aimed at **Botpress Studio feel** (shell, tabs, webchat) — see `BOTPRESS_GAP_PLAN.md` — while **explicitly skipping** canvas, Desk, Always Alive, billing clone.

---

## 2. Architecture (how Botpress agents work)

### 2.1 Studio + Autonomous Node

- **Agent Studio** — visual flows: Nodes + Cards.  
- **Autonomous Node** — LLM decides what to say and which tools to run (vs linear Card execution).  
- Knowledge Bases attach to Autonomous Nodes (`search` / RAG model override).  
- Tables = structured data inside the agent.

### 2.2 LLMz engine (core differentiator)

Botpress’s public engineering story:

| Piece | Role |
|-------|------|
| **LLMz** | Inference engine: instructions → **TypeScript code execution** in sandbox instead of classic tool-calling roundtrips |
| **ZUI** | Strict schemas for tool I/O so multi-step chains don’t “guess” return shapes |
| **ZAI Learning Loop** | Natural-language feedback injected back into future executions |

Claimed benefits: fewer LLM roundtrips, lower cost, safer multi-step reasoning, feedback compounds.

This is a **custom runtime**, not “call Chat Completions with a system prompt.”

### 2.3 Knowledge base

- Centralized KBs: websites, PDFs, documents, tables → **vector / RAG** retrieval.  
- Autonomous Node “Search Knowledge” section.  
- Override RAG model separately from chat model (Best/Fast model configs in Studio).

### 2.4 Automations / flows

- Visual orchestration + Autonomous LLM islands.  
- Human handoff with full context.  
- Escalation rules / fallbacks (“AI that knows its limits”).  
- Resolve → Escalate → Improve loop on homepage marketing.

### 2.5 Integrations & channels

- Hub: WhatsApp, Telegram, Zapier, Zendesk, Slack-class connectors, APIs.  
- Web embed + messaging channels.  
- Can sit **on top of existing helpdesk** or use **Botpress Desk**.

### 2.6 LLM working

- Multi-provider LLM integrations behind standard schemas.  
- Best Model / Fast Model abstraction.  
- LLMz makes providers more interchangeable for tool/code execution.  
- Isolated runtime per agent version.

### 2.7 Response / execution flow

```
User message
  → Flow hit Autonomous Node
  → LLMz plans (as code): knowledge search + tools
  → ZUI-validated tool results
  → Message(s) to user
  → Optional handoff
  → ZAI feedback stored for next runs
```

Compare Hapy:

```
User message
  → Save USER
  → Stuff knowledge into system prompt
  → One chatCompletion
  → Save ASSISTANT
  → classifyCategoryAndSentiment
```

---

## 3. Hapy today (same lenses)

| Lens | Botpress | Hapy now |
|------|----------|----------|
| Builder UX | Visual Studio + Autonomous Nodes | Form + tabs Studio (Botpress-*feel*, not canvas) |
| Runtime | LLMz + sandbox TS | Next.js API + OpenAI SDK |
| Knowledge | Vector KB + search tool | Stuffing |
| Tools / actions | First-class | None |
| Learning | ZAI loop | Analytics + feedback field |
| Channels | Many | Embed only |
| Handoff / Desk | Yes | Admin inspect only |
| Multi-LLM | Yes | Single OpenAI (+ optional env model) |
| Pricing story | No seat tax | N/A intern |

UI parity from old gap plan: Phase 4–9 shell/webchat/analytics — **largely shipped**. Engine parity: **not started**.

---

## 4. Gap severity

| Capability | Gap | Backlog map |
|------------|-----|-------------|
| Flow canvas | Huge | **P3-FLOWS** (named OOS — do not start casually) |
| LLMz / code-exec agent runtime | Huge | Research; not MVP — would be new engine product |
| Vector KB | Large | **P3-RAG** |
| Autonomous tools | Huge | Future actions / integrations |
| ZAI learning loop | Medium | Feedback → prompt/KB suggestions (careful of Never) |
| Multi-channel | Huge | **P3-CHANNELS** |
| Desk / handoff | Large | **P3-DESK** |
| Multi-LLM picker | Medium | **P3-MODEL-PICKER** / **P3-LLM** (no fine-tune) |
| Studio polish | Small | **W3-7** |

---

## 5. Path to Botpress-*class* capability without cloning Studio canvas

Internship rule: *do not expand horizontally*; canvas stays **P3-FLOWS**.

### Smart path (recommended)

1. Keep Hapy as **prompt + knowledge + embed** product (identity).  
2. Steal Botpress **outcomes**, not UI:  
   - Better retrieval (**W3-1 → P3-RAG**)  
   - Allowlisted **tools** (HTTP/webhooks) invoked in a **single server-side agent loop** (mini LLMz — TypeScript in *your* Node process, not a visual canvas)  
   - Feedback → “learning notes” per agent (ZAI lite)  
   - Handoff flag (**P3-DESK**)  
3. Keep Studio tabs; add **“Actions”** settings page instead of flow canvas.  
4. Do **not** rebuild Botpress Engine / V8 isolate fleet.

### If someone insists on canvas later

Only under explicit reopen of **P3-FLOWS**, after RAG + tools exist — otherwise canvas is empty decoration.

---

## 6. Alignment with existing `BOTPRESS_GAP_PLAN.md`

That file’s MVP checklist (shell, chat, tabs, embed, analytics) is **done**.  
Remaining Botpress gaps are exactly the **OOS** list it already named: canvas, multi-channel, human desk, billing.

Update mental model: **UI catch-up complete; engine catch-up is the new gap.**

---

## 7. Verdict

Botpress = **builder platform + custom agent runtime (LLMz)** optimized for **actionful** support.  
Hapy = **opinionated support agent SaaS** with Botpress-like **chrome**, OpenAI-like **brain**, and unique **embed origin + insights + admin**.

To reach Botpress *level* on hard tickets: add **tool-using agent loop + RAG**, not a flow canvas first.

**Related:** [`FUSION_PLAN_HAPY_UNIQUE.md`](FUSION_PLAN_HAPY_UNIQUE.md).
