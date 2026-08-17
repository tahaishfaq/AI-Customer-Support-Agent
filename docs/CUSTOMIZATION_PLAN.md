# Agent Customization — Plan

**Status:** Phase **6** complete — Customization UI + `/chat` widget wiring done  
**Related:** Phases renumbered — Studio **7**, Webchat **8**, Analytics **9**, Deploy **10**  
**Sources:** `CUSTOMIZATION_NOTES.md` + agent page screenshot  
**Related:** Phase 6 (Studio tabs) + prep for Phase 7 (Webchat embed)

---

## Goal

Add a **Customization** tab on the agent page (next to Analytics) where owners configure webchat identity, appearance, deploy/embed settings, and chat features — with a live preview — using **Hapy teal branding** (not Botpress dark/blue clone).

Also: **remove the Dashboard “Chart integrations” mock chart section** (demo scroll mocks only).

---

## Placement in UI

**Agent tabs (AgentHero / Studio):**

`Overview` · `Knowledge` · `Analytics` · **`Customization`** · `Test`

*(Test + Share are Phase 7. This Phase 6 plan owns Customization only.)*

| Item | Choice |
|------|--------|
| Tab label | **Customization** |
| Route | `/agents/[id]/customization` |
| Card shortcut | Optional later on `AgentCard` (same as Knowledge / Analytics icons) |

Same shell pattern as Knowledge / Analytics: `AgentHero` + page content below.

---

## Page layout (Botpress-like, Hapy look)

```
┌─────────────────────────────────────────────────────────────┐
│ AgentHero (tabs include Customization)                      │
├──────────────────────────────┬──────────────────────────────┤
│ Left: settings               │ Right: live widget preview   │
│  - Sub-nav (4 sections)      │  - Chat window               │
│  - Form for active section   │  - Launcher / proactive      │
│  - Save / Publish            │  - Reflects all sections     │
└──────────────────────────────┴──────────────────────────────┘
```

**Sub-nav inside Customization** (not top-level agent tabs):

1. **Identity** — Bot Identity  
2. **Appearance** — Agent Appearance  
3. **Deploy** — Bot / Deploy Settings  
4. **Features** — Agent Features (Chat Settings)

Top of left panel: section title + **Save** (Hapy wording; Botpress “Publish Changes”).

App shell stays light + teal; preview panel can use a subtle grid (like Chat embed preview today).

---

## Scope by section

### 1. Identity (MVP — full UI)

| Field | Notes |
|-------|--------|
| Avatar | Upload (Cloudinary) or monogram fallback |
| Display name | Defaults from `agent.name`; can diverge for widget |
| Description | Widget “about”; can map from `agent.description` |
| Message placeholder | Composer placeholder |
| Footer | Default Hapy footer text/link (not Botpress) |
| Contact email / phone / website | Optional links in widget info |
| Terms / Privacy URLs | Optional |

**Keep on Edit agent (not moved):** `systemPrompt`, `welcomeMessage` — Overview / Edit stay source of truth for behavior. Welcome still drives first chat message; Identity is presentation.

### 2. Appearance (MVP — full UI + preview)

| Control | Default / notes |
|---------|-----------------|
| Primary color | `#0b5f58` + reset |
| Font | Instrument Sans / DM Sans (+ maybe system) |
| Theme | Light / Dark |
| Header style | Solid / Primary |
| Message styling | Light / Darker bubbles |
| Corner radius | Slider |
| Custom CSS | **Defer to later** (store empty; no editor in MVP) |

### 3. Deploy (MVP — UI + stub embed)

| Control | Notes |
|---------|--------|
| Embed code | Read-only snippet + copy. Real public script/`publicKey` = **Phase 7**. MVP: placeholder snippet + “coming with public embed” or generate key early and wire later. |
| Chat interface | **Toggle** (floating) · **Embedded** (inline) |
| Chat launcher | **Chat Bubble** · **Custom Element** (custom = show selector/hint; full custom element API later) |
| Button image | Upload or “Use bot avatar” |
| Proactive message | Toggle + short text; preview bubble |

Map Toggle placements to existing Chat preview ideas: bottom-right / bottom-left; Embedded ≈ inline/full-page style in preview.

### 4. Features (MVP — toggles + wire what we have)

| Control | MVP behavior |
|---------|----------------|
| Conversation History | Wire to existing History UI (on/off) |
| Message Feedback | Toggle + UI affordance; persistence optional later |
| Allow File Upload | Toggle + composer icon; **upload backend later** |
| Notification sound | Toggle; play simple sound client-side when on |
| Chat History Reset | Dropdown: Never / Session / 1d / 7d (client policy) |
| Advanced Settings | Skip until screenshots exist |

---

## Data model

Today `Agent` only has: `name`, `description`, `systemPrompt`, `welcomeMessage`.

**Recommended:** add JSON config on Agent (simple, one migration):

```prisma
// Agent
avatarUrl          String?
displayName        String?   // widget name; null → use name
// OR single JSON:
customization      Json?     // identity + appearance + deploy + features
publicKey          String?   @unique  // for Phase 7 embed (optional now)
```

**Prefer one `customization Json`** (+ optional `avatarUrl` / `publicKey` as top-level if needed for queries) so we don’t explode columns.

Defaults applied in code when `customization` is null.

**API:** extend `PATCH /api/agents/[id]` (or `PATCH .../customization`) with Zod schema for the JSON shape. Avatar via existing Cloudinary upload pattern (knowledge PDFs).

---

## Live preview

Reuse / adapt `ChatWidget` + `EmbedPreview` patterns from `/chat`:

- Preview reads **draft** customization state (optimistic, before save).  
- Identity + appearance drive colors, fonts, radius, header, footer, placeholder.  
- Deploy drives launcher / proactive / toggle vs embedded.  
- Features show history button, feedback icons, attach icon when toggled.

Preview is **visual**; full public embed behavior lands in Phase 7.

---

## Dashboard cleanup (same delivery)

Remove from `app/(app)/dashboard/page.jsx`:

- “Chart integrations” section  
- `ChartMockCard` + `DemoTrendChart` / `DemoTopicChart` / `DemoSentimentChart` / `DemoInsights` imports used only there  

Keep real Home stats / recent conversations. Agent **Analytics** tab / global analytics demo can stay until Phase 8 (unless you want those stripped too — default: **only Dashboard mocks**).

---

## Files to touch (implementation checklist)

| Area | Work |
|------|------|
| `AgentHero.jsx` | Add Customization tab |
| `app/(app)/agents/[id]/customization/page.jsx` | New page |
| `components/customization/*` | Layout, sub-nav, Identity/Appearance/Deploy/Features forms, Preview |
| `prisma/schema.prisma` + migration | `customization` Json (+ optional avatar/publicKey) |
| `lib/validations` + `agent.service` + API | Read/update customization |
| `ChatWidget` / composer / messages | Consume customization when available |
| `dashboard/page.jsx` | Remove mock chart block |
| `CUSTOMIZATION_NOTES.md` / this plan | Mark built when done |

---

## Phased build order (when you say “build”)

1. **Cleanup** — Remove Dashboard mock charts ✅  
2. **Shell** — Tab + route + left/right layout + sub-nav + Save stub ✅  
3. **Schema + API** — `customization` JSON + PATCH ✅  
4. **Identity + Appearance** — forms + live preview theming ✅  
5. **Deploy** — UI + placeholder embed + launcher/proactive preview ✅  
6. **Features** — toggles; wire History; soft UI for feedback/upload/sound ✅  
7. **Polish** — Apply settings on `/chat` for that agent ✅  

---

## Out of scope (this feature)

- Real public CDN embed + `/w/[publicKey]` (Phase 8)  
- File upload storage pipeline  
- Feedback analytics pipeline  
- Advanced Settings (unknown)  
- Moving system prompt / welcome out of Edit  
- Cloning Botpress dark dashboard chrome  

---

## Success criteria

- [x] Agent page has **Customization** next to Analytics  
- [x] Four sections editable with Save  
- [x] Live preview updates with draft settings  
- [x] Settings persist per agent  
- [x] Dashboard mock chart section gone  
- [x] Hapy teal defaults; no Botpress black/blue shell  
- [x] `/chat` widget applies saved customization  

---

**Next:** Phase 7 Studio tabs (see `NEXTJS_FULLSTACK_PLAN.md`).
