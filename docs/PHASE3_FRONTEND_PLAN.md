# Phase 3 Frontend — Knowledge Base UI

**Scope now:** UI only (JavaScript / JSX)  
**Depends on:** [`PHASE3_BACKEND_PLAN.md`](PHASE3_BACKEND_PLAN.md) APIs tested first  
**App:** `AI-Customer-Support-Agent`  
**Visual language:** existing Hapy teal + Phase 2 dashboard/agents patterns  
**Auth:** NextAuth session (`credentials: "include"` via `apiFetch`)

---

## Goal

From an agent, the user can manage that agent’s knowledge:

1. Open **Knowledge** page for an agent  
2. See document list (TEXT + PDF)  
3. Add **Text / FAQ**  
4. **Upload PDF** (with loading state)  
5. **Delete** document (confirm dialog)  

---

## User stories

1. Agent detail / list → click **Knowledge** → `/agents/[id]/knowledge`  
2. Empty state if no docs yet  
3. Add FAQ with name + content → appears in list  
4. Choose PDF → upload → appears as type PDF  
5. Delete with confirm → removed from list  

---

## Routes (App Router)

| Path | Page |
|------|------|
| `/agents/[id]/knowledge` | Knowledge list + add TEXT + upload PDF |

All under existing `app/(app)/` layout (header + auth).  
`proxy.js` already protects `/agents/:path*` — no matcher change required unless path was missing (it is covered).

### Entry points (update existing UI)

| Place | Change |
|-------|--------|
| Agent card | Enable / add **Knowledge** link → `/agents/[id]/knowledge` |
| Agent detail page | Primary action **Knowledge** (replace “soon” hint) |
| Optional | Agents list footer — remove “Knowledge & Chat — soon” or keep Chat as soon only |

---

## 1. Knowledge page layout

```
← Back to agent
Agent name (subtitle)

[ Add Text / FAQ ]   [ Upload PDF ]

─────────────────────────────
📄 Services FAQ     TEXT   [Delete]
📄 Product Guide    PDF    [Delete]
```

### List item shows

- Name  
- Type badge (`TEXT` / `PDF`)  
- Created date  
- Optional: content preview (first ~120 chars) — nice-to-have  
- Delete button  

### States

| State | UI |
|-------|-----|
| Loading | Skeleton rows |
| Empty | “No knowledge yet. Add FAQ text or upload a PDF.” + CTAs |
| Error | Inline message + retry |
| Uploading | Disable controls + spinner on PDF button |
| Success | Toast (sonner) optional — or list refresh is enough |

---

## 2. Add Text / FAQ

UI: dialog **or** inline panel (prefer **Dialog** like delete confirm — matches Phase 2).

Fields:

| Field | Required |
|-------|----------|
| Name | Yes |
| Content | Yes (textarea) |

On submit:

```js
POST /api/agents/:id/knowledge
Content-Type: application/json
{ name, type: "TEXT", content }
```

Client validation mirrors backend Zod.  
On success → close dialog → refresh list.

---

## 3. Upload PDF

- File input `accept="application/pdf,.pdf"`  
- Max 10MB client check (show friendly error before upload)  
- Build `FormData`:

```js
const form = new FormData();
form.append("file", file);
// optional: form.append("name", customName);
```

- Call API **without** forcing `Content-Type: application/json`  
  (browser sets multipart boundary)

Important: update `apiFetch` **or** add `apiUpload` helper that:

- uses `credentials: "include"`  
- does **not** set `Content-Type: application/json` for FormData  

On success → refresh list.

---

## 4. Delete

Reuse pattern from `DeleteAgentDialog`:

- shadcn Dialog confirm  
- `DELETE /api/knowledge/:id` → 204  
- Refresh list (stay on knowledge page)

---

## 5. Files to create / update

```
# API helpers
lib/api/knowledge.js
  - listKnowledge(agentId)
  - createTextKnowledge(agentId, { name, content })
  - uploadPdfKnowledge(agentId, file, name?)
  - deleteKnowledge(id)

# Components
components/knowledge/KnowledgeList.jsx
components/knowledge/KnowledgeItem.jsx
components/knowledge/AddTextKnowledgeDialog.jsx
components/knowledge/UploadPdfKnowledge.jsx
components/knowledge/DeleteKnowledgeDialog.jsx

# Page
app/(app)/agents/[id]/knowledge/page.jsx

# Wire entry points
components/agents/AgentCard.jsx          # Knowledge link
app/(app)/agents/[id]/page.jsx           # Knowledge CTA
```

Optional: small tweak to `lib/api-client.js` for FormData uploads.

---

## 6. Implementation order (after backend DONE)

1. `lib/api/knowledge.js` (+ FormData-safe upload helper)  
2. Knowledge page shell + list (loading/empty/error)  
3. Add Text dialog  
4. PDF upload control  
5. Delete dialog  
6. Link from Agent card + Agent detail  
7. Browser E2E: agent → add FAQ → upload PDF → delete  

---

## 7. Design notes

- Same CSS vars / rounded-2xl cards as Phase 2 polish  
- Type badges: soft teal for TEXT, soft slate/info for PDF  
- Keep page focused — one job: manage knowledge  
- Mobile: stack actions full-width  

---

## Phase 3 Frontend checklist

- [x] `/agents/[id]/knowledge` page works  
- [x] List TEXT + PDF documents  
- [x] Add Text / FAQ works  
- [x] PDF upload + loading state works  
- [x] Delete with confirmation works  
- [x] Empty / loading / error states  
- [x] Entry links from agent card + detail  
- [x] Full flow tested in browser  
- [x] **PHASE 3 FRONTEND DONE**  

---

## Out of scope

- Live chat using knowledge (Phase 4)  
- Editing an existing document (delete + re-add is enough for MVP)  
- Drag-and-drop multi-file upload  
- Vector search / embeddings UI  
- Storing/downloading original PDF files  
