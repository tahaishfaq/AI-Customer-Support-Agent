# Workspace origin share, knowledge share, embed base URL

## What shipped

### Same-workspace site origin

- `Agent.siteKnowledgeOrigin` is no longer globally unique.
- Agents in the **same workspace** may claim and crawl the same live HTTPS origin.
- Agents in a **different workspace** still get `origin_taken` / `CRAWL_ORIGIN_TAKEN`.

### Knowledge sharing

- Per-document **Share** on Knowledge rows opens a modal to pick same-workspace agents.
- `KnowledgeDocumentShare` is a live link (not a copy): source edits/crawl updates appear for consumers automatically.
- Consumer knowledge list shows a **Shared with this agent** section with “Shared from {agent}”.
- Consumer can **Remove** (unlink) without deleting the source document.

### Manual embed base URL

- **Deploy → Website base URL**: owner enters one or more HTTPS origins.
- Saving customization sets `features.allowedOriginsMode=allowlist` and `features.allowedOrigins`.
- When the agent is unlocked, the primary origin is also written to `siteKnowledgeOrigin`.
- Public embed/ping only succeed from allowlisted origins (localhost / Aide preview carve-outs unchanged).
- Features → Embed origins stays in sync with the same fields.

## Migration

`prisma/migrations/20260929180000_workspace_origin_knowledge_share/migration.sql`

```bash
npx prisma migrate deploy
# or locally:
npx prisma migrate dev
```
