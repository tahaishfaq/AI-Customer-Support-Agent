# Hapy vs Botpress — Gap Analysis & Roadmap

**Goal:** Hapy ko **Botpress-jaisa product feel** dena (Studio / agent builder vibe), bina full Botpress clone kiye.  
**Reference:** [app.botpress](https://app.botpress.com) · Studio · Webchat  
**App:** `AI-Customer-Support-Agent`  
**Canonical MVP phases:** [`NEXTJS_FULLSTACK_PLAN.md`](NEXTJS_FULLSTACK_PLAN.md) (**Phases 0–9**)  
**Redesign plan:** [`PHASE4_REDESIGN_PLAN.md`](PHASE4_REDESIGN_PLAN.md)

> **Alignment (renumbered):**  
> **UI shell / Botpress look → Phase 4** (see [`PHASE4_REDESIGN_PLAN.md`](PHASE4_REDESIGN_PLAN.md) — SRD screens + your Cloud screenshots)  
> Chat E2E → **Phase 5** · Studio tabs → **Phase 6** · Webchat → **Phase 7** · Analytics charts → **Phase 8** · Deploy → **Phase 9**  
> Optional upgrades (URL ingest / streaming / citations) → post-MVP  
> **Do not clone from screenshots:** Billing, AI Spend, Integrations Hub, Always Alive, Human Handoff.

---

## 1. Reality check

Botpress = Studio + Webchat + channels + Desk + ADK.  
Hapy MVP = **redesign shell + knowledge + chat + Studio tabs + embed webchat + analytics** — not a full clone.

---

## 2. Hapy status

| Area | Status |
|------|--------|
| Auth / Agents / Knowledge (+ Cloudinary) | Done (Phases 0–3) |
| Botpress-like redesign (sidebar, density) | **Phase 4 — next** |
| Chat + Conversations | Mostly done → Phase 5 |
| Agent Studio tabs | Phase 6 |
| Webchat embed | Phase 7 |
| Analytics charts | Phase 8 |
| Deploy | Phase 9 |
| Flow canvas / WhatsApp / Desk | Out of MVP |

---

## 3. Gap → phase map

| Gap | Fullstack phase | MVP? |
|-----|-----------------|------|
| Cloud shell + Botpress-like UI (Hapy colors/fonts) | **Phase 4** | Yes |
| Chat emulator + history | **Phase 5** | Yes |
| Studio hub tabs | **Phase 6** | Yes |
| Webchat embed + Share | **Phase 7** | Yes |
| Analytics charts + insights | **Phase 8** | Yes |
| Deploy + polish | **Phase 9** | Yes |
| URL ingest / streaming / citations | Post-MVP | No |

---

## 4. Must-have Botpress feel

1. **Phase 4** — Sidebar shell + denser product UI (Hapy teal + Instrument/DM)  
2. **Phase 6** — Agent Studio tabs  
3. **Phase 7** — Embeddable Webchat  
4. **Phase 8** — Analytics  

**Keep:** Hapy `--color-primary`, fonts — see [`PHASE4_REDESIGN_PLAN.md`](PHASE4_REDESIGN_PLAN.md).

**Skip:** canvas, multi-channel, human desk, billing.

---

## 5. Screen map

```
/dashboard, /agents, /chat, /conversations, /analytics  ← Phase 4 shell
/agents/[id]?tab=...                                    ← Phase 6
/w/[publicKey] + embed.js                               ← Phase 7
```

---

## 6. Checklist

### Phase 4 — Redesign
- [ ] AppShell + Sidebar  
- [ ] Pages polished under shell  
- [ ] Hapy colors/fonts only  

### Phase 5 — Chat
- [ ] E2E with OpenAI  
- [ ] Fits Phase 4 layout  

### Phase 6 — Studio tabs
- [ ] Overview / Instructions / Knowledge / Test / Share  

### Phase 7 — Webchat
- [ ] publicKey, public API, widget, Share snippet  

### Phase 8 — Analytics
- [ ] Charts + insights  

### Phase 9 — Ship
- [ ] Vercel + README embed docs  

---

## 7. Next step

Implement **Phase 4** → [`PHASE4_REDESIGN_PLAN.md`](PHASE4_REDESIGN_PLAN.md) · track in [`NEXTJS_FULLSTACK_PLAN.md`](NEXTJS_FULLSTACK_PLAN.md).
