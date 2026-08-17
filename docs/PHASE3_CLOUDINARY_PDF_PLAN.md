# Phase 3 revision — PDF via Cloudinary (not DB file storage)

**Status:** Implemented  
**App:** `AI-Customer-Support-Agent`  
**Why:** PDF file ko Neon/DB ya local disk pe store nahi karna. File **Cloudinary** pe upload hogi → **public URL** milegi → us URL se PDF open/get/extract hoga.  
**Depends on:** Existing Phase 3 knowledge APIs + UI  
**Related:** [`PHASE3_BACKEND_PLAN.md`](PHASE3_BACKEND_PLAN.md), [`PHASE3_FRONTEND_PLAN.md`](PHASE3_FRONTEND_PLAN.md), [`api-contract.md`](api-contract.md)

---

## Goal

Authenticated user uploads a PDF for an agent:

1. Server uploads PDF to **Cloudinary**  
2. Cloudinary returns a **public URL** (+ `public_id`)  
3. DB stores **metadata + URL** (and extracted text for chat) — **not** the binary PDF  
4. UI / chat can use the public URL to open or re-fetch the PDF  

TEXT / FAQ flow **unchanged** (still JSON → DB `content` only).

---

## Current vs new

| Piece | Ab (Phase 3 MVP) | Naya (Cloudinary) |
|-------|------------------|-------------------|
| PDF binary | DB mein nahi (sirf extracted text) | Cloudinary pe |
| DB fields | `name`, `type`, `content` (text) | + `fileUrl`, `cloudinaryPublicId` |
| Preview / download | Only extracted text preview | Public URL se original PDF open |
| Delete | DB row delete | Cloudinary asset delete **+** DB row |
| Chat (Phase 4) | `content` text in prompt | Same — still use extracted `content` |

**Important product rule:** Chat ko PDF bytes nahi chahiye — usay **text** chahiye.  
Is liye upload pe:

```
buffer → (A) Cloudinary upload → fileUrl
       → (B) pdf-parse extract → content
DB save: name, type=PDF, content, fileUrl, cloudinaryPublicId
```

Agar sirf URL store karo aur text extract na karo, to har chat pe PDF fetch + parse karna padega (slow + fragile). **MVP = upload pe ek dafa extract + URL dono save.**

---

# PART A — Backend

## A1. Env vars

`.env` / `.env.example`:

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
# optional
CLOUDINARY_FOLDER=hapy/knowledge
```

Cloudinary dashboard → Settings → API Keys se values lo.

## A2. Package

```bash
npm install cloudinary
```

`pdf-parse` **rehne do** (text extract ke liye).

## A3. Prisma migration (required)

`KnowledgeDocument` mein fields add:

```prisma
model KnowledgeDocument {
  id                 String        @id @default(cuid())
  agentId            String
  name               String
  type               KnowledgeType
  content            String        // TEXT body OR extracted PDF text (for chat)
  fileUrl            String?       // Cloudinary secure_url (PDF only)
  cloudinaryPublicId String?       // for destroy on delete (PDF only)
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
  agent              Agent         @relation(...)

  @@index([agentId])
}
```

| Field | TEXT docs | PDF docs |
|-------|-----------|----------|
| `content` | FAQ text | extracted text |
| `fileUrl` | `null` | Cloudinary `secure_url` |
| `cloudinaryPublicId` | `null` | Cloudinary `public_id` |

```bash
npx prisma migrate dev --name knowledge_cloudinary_pdf
```

## A4. Files to create / update

```
lib/cloudinary.js                    # NEW — configured cloudinary client
lib/utils/cloudinary-pdf.js          # NEW — uploadPdfBuffer, deleteCloudinaryAsset
lib/services/knowledge.service.js    # UPDATE createPdf + delete
app/api/agents/[id]/knowledge/...   # response already returns document (new fields auto)
docs/api-contract.md                 # UPDATE Knowledge PDF response shape
```

## A5. Upload flow (replace current PDF branch)

```
1. requireAuth + getAgentForUser
2. Validate file (PDF mime/ext, max 10MB) — same as Phase 3
3. buffer = Buffer.from(await file.arrayBuffer())
4. Upload to Cloudinary:
     resource_type: "raw"          # PDFs are not images
     folder: CLOUDINARY_FOLDER
     public_id: optional cuid / timestamp
5. If Cloudinary fails → 502/500 "Upload failed" (DB mein kuch mat likho)
6. text = await extractTextFromPdf(buffer)
7. If empty text → optional policy:
     - Prefer: still save PDF URL, content = "" or short note, OR
     - Strict: 400 + delete Cloudinary asset (cleaner for chat)
   Recommended MVP: if empty → delete Cloudinary asset → 400
8. Create KnowledgeDocument {
     type: PDF,
     name,
     content: text,
     fileUrl: result.secure_url,
     cloudinaryPublicId: result.public_id
   }
9. Return 201 document (includes fileUrl)
```

### Cloudinary upload sketch

```js
// resource_type: "raw" for PDF
cloudinary.uploader.upload_stream(
  { resource_type: "raw", folder: "hapy/knowledge", format: "pdf" },
  callback
)
```

Ya `upload` with data URI / temp — stream preferred for Next.js buffers.

## A6. Delete flow (update)

```
1. Load document + agent ownership
2. If type === PDF && cloudinaryPublicId:
     cloudinary.uploader.destroy(publicId, { resource_type: "raw" })
     // if Cloudinary delete fails: log + still delete DB? or fail?
     // Recommended: try Cloudinary first; on failure return 502; on success delete DB
3. Delete DB row → 204
```

TEXT deletes: DB only (no Cloudinary).

## A7. List / GET response

Include new fields so UI can show “Open PDF”:

```json
{
  "id": "...",
  "agentId": "...",
  "name": "Product Guide",
  "type": "PDF",
  "content": "Extracted text...",
  "fileUrl": "https://res.cloudinary.com/.../raw/upload/....pdf",
  "cloudinaryPublicId": "hapy/knowledge/abc",
  "createdAt": "...",
  "updatedAt": "..."
}
```

TEXT items: `fileUrl: null`, `cloudinaryPublicId: null`.

## A8. Optional later (out of scope now)

- Re-fetch PDF from `fileUrl` and re-extract if `content` empty  
- Signed / private Cloudinary URLs (MVP = **public** raw URL as you asked)  
- Client-side direct upload to Cloudinary (unsigned preset) — skip; keep server upload for auth control  

## A9. Backend test checklist

- [x] Env vars documented in `.env.example`  
- [x] Prisma migrate `fileUrl` + `cloudinaryPublicId`  
- [x] Upload path uses Cloudinary + extract text  
- [x] Delete removes Cloudinary asset + DB row  
- [ ] Env vars set locally; upload PDF → **201** with non-empty `fileUrl`  
- [ ] Cloudinary Media Library mein file dikhe  
- [ ] Browser mein `fileUrl` open → PDF download/view  
- [ ] Delete PDF → Cloudinary se gayab + DB 204  

## B4. Frontend checklist

- [x] Upload PDF → list can show Open PDF when `fileUrl` present  
- [x] Preview shows extracted text + Open original PDF link  
- [x] Delete confirm unchanged  
- [ ] Live upload tested after Cloudinary keys added

---

# PART C — Chat / Phase 4 impact

`chat.service.js` already uses `KnowledgeDocument.content`.

- **No chat code change required** if we keep extracting text on upload.  
- Prompt mein `fileUrl` bhejne ki zaroorat nahi (model PDF URL se reliably nahi padhta unless tools).  
- Optional future: mention in system prompt “Source PDF: {fileUrl}” for citations — nice-to-have.

---

# PART D — Implementation order

1. Cloudinary account + env vars  
2. `npm install cloudinary` + `lib/cloudinary.js` helpers  
3. Prisma migrate (`fileUrl`, `cloudinaryPublicId`)  
4. Update `createPdfKnowledge` + `deleteKnowledgeForUser`  
5. Update api-contract Knowledge section  
6. UI: Open PDF link on list/preview  
7. Smoke test upload → open URL → chat still uses knowledge text → delete  

---

## Out of scope

- Storing PDF bytes in Postgres  
- Local `/public` or S3 (Cloudinary only for this plan)  
- Client-side unsigned Cloudinary upload widget  
- Private/authenticated Cloudinary delivery  
- Replacing TEXT knowledge with file storage  

---

## Decision summary (confirm before code)

| Decision | Choice |
|----------|--------|
| Where PDF lives | Cloudinary (`resource_type: raw`) |
| What DB stores | `fileUrl` + `cloudinaryPublicId` + extracted `content` |
| When to extract text | On upload (same request) |
| Who uploads to Cloudinary | Server (authenticated API) |
| Public URL | Yes (`secure_url`) — as requested |

Jab bolein **implement karo**, tab Part A → test → Part B order follow karenge.
