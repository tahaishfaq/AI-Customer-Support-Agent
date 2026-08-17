# Phase 3 Backend — Knowledge Base (Text + PDF)

**Scope now:** Protected APIs only (JavaScript)  
**Out of scope now:** Knowledge UI (→ [`PHASE3_FRONTEND_PLAN.md`](PHASE3_FRONTEND_PLAN.md))  
**App:** `AI-Customer-Support-Agent`  
**Contract:** [`api-contract.md`](api-contract.md) (Knowledge section)  
**Depends on:** Phase 2 agents APIs + NextAuth session (`requireAuth`)

---

## Goal

Authenticated user can, **for their own agents**:

1. **List** knowledge documents  
2. **Add TEXT / FAQ** (JSON body)  
3. **Upload PDF** → extract text → store in DB  
4. **Delete** a knowledge document  

UI comes **after** this backend is tested (Postman / curl).

---

## Why this phase matters

Chat (Phase 4) will answer using agent knowledge.  
Phase 3 only **stores** knowledge. No OpenAI chat yet.

| Source | How it enters the system |
|--------|--------------------------|
| Text / FAQ | User posts `name` + `content` (`type: TEXT`) |
| PDF | User uploads file → `pdf-parse` extracts text → store (`type: PDF`) |

**MVP rule:** Store **extracted text only**. Do **not** keep the raw PDF file on disk/S3 for now.

---

## Auth & ownership rules (all routes)

- Use existing `requireAuth()` → NextAuth `auth()` session  
- Missing/invalid session → **401**  
- Agent must belong to current user → else **403** (if agent exists for someone else) or **404**  
- Knowledge delete: document’s agent must belong to current user → else **403** / **404**  
- Same error body as Phase 2: `{ error: { message, details } }`  
- Use `NextResponse.json` — **no** `lib/api-response.js`  
- See [`NEXT_API_ERROR_CONVENTIONS.md`](NEXT_API_ERROR_CONVENTIONS.md)

---

## 1. No new Prisma models

`KnowledgeDocument` already exists in `prisma/schema.prisma`:

| Field | Type | Notes |
|-------|------|--------|
| id | cuid | |
| agentId | string | FK → Agent (cascade delete) |
| name | string | display name |
| type | `KnowledgeType` | `TEXT` \| `PDF` |
| content | string | FAQ text or extracted PDF text |
| createdAt / updatedAt | DateTime | |

Enums already include `KnowledgeType`.

**No migration needed** unless you later add file-size metadata (skip for MVP).

---

## 2. Packages to add

```bash
npm install pdf-parse
```

Optional (only if needed): nothing else for upload — Next.js Route Handlers support `request.formData()` (no Express multer).

---

## 3. Files to create

```
lib/validations/knowledge.js       # Zod for TEXT create
lib/utils/pdf.js                   # extractTextFromPdf(buffer)
lib/services/knowledge.service.js  # list / createText / createPdf / delete + ownership

app/api/agents/[id]/knowledge/route.js   # GET list, POST text|pdf
app/api/knowledge/[id]/route.js          # DELETE
```

Reuse:

- `lib/require-auth.js`  
- `lib/services/agent.service.js` → `getAgentForUser(id, userId)` for ownership  
- `lib/prisma.js`

---

## 4. API routes

| Method | Path | Status | Body |
|--------|------|--------|------|
| GET | `/api/agents/[id]/knowledge` | 200 | `{ documents: [...] }` |
| POST | `/api/agents/[id]/knowledge` | 201 | JSON **or** multipart |
| DELETE | `/api/knowledge/[id]` | **204** | empty |

### GET list

- Auth + agent ownership  
- Order: newest first (`createdAt desc`)  
- Return full document fields (id, agentId, name, type, content, createdAt, updatedAt)

### POST — Text / FAQ

`Content-Type: application/json`

```json
{
  "name": "Services FAQ",
  "type": "TEXT",
  "content": "Q: What services does Hapy provide?\nA: Hapy provides custom software development..."
}
```

| Field | Rules |
|-------|--------|
| name | required, trim, min 1 |
| type | must be `"TEXT"` (or omit and force TEXT in service) |
| content | required, trim, min 1 |

### POST — PDF upload

`Content-Type: multipart/form-data`

| Field | Rules |
|-------|--------|
| file | required; PDF only (`application/pdf` or `.pdf`); max **10 MB** |
| name | optional; default = original filename |

Flow:

```
1. requireAuth
2. getAgentForUser(agentId, userId)
3. Read formData → file
4. Validate mime/extension + size
5. buffer = Buffer.from(await file.arrayBuffer())
6. text = await extractTextFromPdf(buffer)
7. If empty text → 400 "Could not extract text from PDF"
8. Create KnowledgeDocument { type: PDF, name, content: text }
9. Return 201 document
```

### DELETE `/api/knowledge/[id]`

- Load document + agent  
- If not found → 404  
- If agent.userId !== current user → 403  
- Delete → 204  

---

## 5. Validation (Zod) — TEXT only

```js
// createTextKnowledgeSchema
{
  name: trim min 1,
  type: z.literal("TEXT").optional(), // or required TEXT
  content: trim min 1
}
```

PDF validation is **manual** (file type/size) — not Zod JSON.

Errors: **400** + `{ error: { message: "Validation failed", details } }`

---

## 6. Service rules

1. Always go through agent ownership before list/create  
2. Reuse `getAgentForUser` from agent service  
3. Truncate extremely long extracted text if needed (optional MVP: store as-is; Postgres text is fine)  
4. Never write uploaded files to `/public` or disk for MVP  

---

## 7. Implementation order

1. Install `pdf-parse` + `lib/utils/pdf.js`  
2. Zod + `knowledge.service.js`  
3. `GET/POST /api/agents/[id]/knowledge` (TEXT first)  
4. PDF branch on same POST  
5. `DELETE /api/knowledge/[id]`  
6. Postman / curl checklist below  

---

## 8. How to test (Postman / curl)

1. Login (NextAuth session cookie)  
2. Create an agent (Phase 2) → copy `agentId`  
3. `POST` TEXT knowledge → **201**  
4. `GET` knowledge list → includes TEXT doc  
5. `POST` multipart PDF (`file=@guide.pdf`) → **201**, `type: "PDF"`, `content` non-empty  
6. Reject non-PDF / oversized file → **400**  
7. `DELETE /api/knowledge/:id` → **204**; list no longer has it  
8. Other user’s agent id → **403**  
9. No session → **401**  

---

## Phase 3 Backend checklist

- [x] TEXT create + list work  
- [x] PDF upload + text extraction work  
- [x] Delete works (204)  
- [x] Ownership / auth errors correct (401 / 403 / 404)  
- [x] Validation errors return 400 details  
- [x] **PHASE 3 BACKEND DONE** → start frontend plan  

---

## Out of scope

- Knowledge UI pages (frontend plan)  
- Vector search / embeddings / RAG  
- Storing raw PDF files  
- Chat using knowledge (Phase 4)  
- Website crawler  
