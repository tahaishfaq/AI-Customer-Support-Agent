# Production gap closure — 2026-10-06

Implements Final Production Architecture Audit gaps without rewriting the trust path.

## Gap status

| ID | Status | Notes |
| --- | --- | --- |
| AIDE-GAP-001 | CLOSED | DNS-pinned Undici fetch (`lib/actions/pinned-fetch.js`) |
| AIDE-GAP-002 | CLOSED | `lib/actions/limits.js` SSOT |
| AIDE-GAP-003 | CLOSED | GraphQL protocol + fixed operation + variables only |
| AIDE-GAP-004 | CLOSED | Explicit XML protocol + XXE/DTD blocked |
| AIDE-GAP-005 | CLOSED | PUT/PATCH/DELETE + method/risk guards |
| AIDE-GAP-006 | CLOSED | `$.` projection paths + resultInstructions + UI warning |
| AIDE-GAP-007 | CLOSED | Redis fail-closed when `REDIS_ENABLED=1` |
| AIDE-GAP-008 | CLOSED (code) + EXTERNAL_BLOCKED | `scripts/production-preflight.js --production` |
| AIDE-GAP-009 | CLOSED | Sign-off + this note; hybrid RAG acknowledged |
| AIDE-GAP-010 | CLOSED | PEP `isServerProvenPublicMcpRead` + accessClass on MCP shape |
| AIDE-CRAWL-001/002/015 | CLOSED (code) | AUTO HTTP-first; Playwright fallback + rendered DOM links; Chromium env EXTERNAL |
| AIDE-CRAWL-003 | CLOSED | contentHash dedupe |
| AIDE-CRAWL-004 | CLOSED | hash-router `#/` only in render discovery |
| AIDE-CRAWL-005 | CLOSED | gzip sitemap with size caps |
| AIDE-CRAWL-006 | CLOSED (UX) | origin lock ≠ crawl success; Retry crawl |
| AIDE-CRAWL-007 | CLOSED (code) | recrawl sweep without widget ping |
| AIDE-CRAWL-008 | CLOSED | crawler DNS-pinned fetch |
| AIDE-SEC-001 | CLOSED | same as GAP-010 |
| AIDE-GAP-011 | CLOSED | Bounded pagination maxPages ≤ 2 |
| AIDE-GAP-012 | ACCEPTED_POST_MVP | SOAP unsupported |

## Verification

```bash
npm run test:production-gaps
npm run preflight:production   # on prod env
npm run test:full-user-flow-browser
npm run test:production-acceptance
```

### Phase 14 (browser user-flow)

- Suite: `tests/full-user-flow.spec.js` via `npm run test:full-user-flow-browser`
- Covers: register → FREE plan → agent + knowledge → owner edit UI → `/admin` negative → public widget launcher → messenger conversation → knowledge marker `FULLFLOW_OK` → mobile viewport no horizontal break
- Local evidence (2026-10-06):
  - `npm run test:production-gaps` → PASS
  - `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:product` → 10/10 PASS
  - `npm run test:f12e2e` → 16/16 PASS
  - `PLAYWRIGHT_PORT=3000` confirmation-ui → PASS
  - `npm run test:embed-full-browser` → PASS
  - `PLAYWRIGHT_PORT=3000` full-user-flow → **2 passed**
- Verdict for gap closure code: **READY WITH EXTERNAL CUTOVER** (live owner checks remain EXTERNAL_BLOCKED)

### EXTERNAL_BLOCKED (live cutover only)

- OpenAI credits / live model spend
- SafePay live webhook
- Resend domain verification (non-allowlisted recipients)
- Live coral embed origin lock from a real third-party host
- Owner explicit YES on production promote
