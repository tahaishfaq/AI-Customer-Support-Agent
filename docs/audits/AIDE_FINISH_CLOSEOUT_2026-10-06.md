# Aide finish closeout — 2026-10-06

Final product-finishing pass after the post-implementation re-audit. Core architecture was not rewritten.

## A. FINAL VERDICT

| Gate | Verdict |
| --- | --- |
| Design partners | **READY FOR DESIGN PARTNERS** with Chromium worker + Redis + live provider cutover on the target environment |
| Public beta | **NOT READY** until Phase 12 live items pass and a production Chromium crawl worker is deployed |
| GA | **NOT READY** |

## B. GAP STATUS

| ID | Status |
| --- | --- |
| AIDE-GAP-001 | CLOSED (pinned fetch + crawler pin) |
| AIDE-GAP-002 | CLOSED (limits SSOT + drift test) |
| AIDE-GAP-003 | CLOSED (GraphQL stored operation) |
| AIDE-GAP-004 | CLOSED (XML opt-in, XXE/DTD blocked) |
| AIDE-GAP-005 | CLOSED (PUT/PATCH/DELETE matrix) |
| AIDE-GAP-006 | CLOSED |
| AIDE-GAP-007 | CLOSED (Redis fail-closed when enabled; crawl lock same) |
| AIDE-GAP-008 | EXTERNAL_BLOCKED (production preflight on live secrets) |
| AIDE-GAP-009 | CLOSED (sign-off Redis/RAG wording) |
| AIDE-GAP-010 | CLOSED (PEP `isServerProvenPublicMcpRead`) |
| AIDE-GAP-011 | CLOSED |
| AIDE-GAP-012 | ACCEPTED (SOAP post-MVP) |
| AIDE-SEC-001 | CLOSED (same as GAP-010) |
| AIDE-CRAWL-001 | CLOSED (code) / EXTERNAL_BLOCKED (live Chromium) |
| AIDE-CRAWL-002 | CLOSED (code) — AUTO HTTP then render fallback |
| AIDE-CRAWL-003 | CLOSED — contentHash skip |
| AIDE-CRAWL-004 | CLOSED — `#/` hash routes only |
| AIDE-CRAWL-005 | CLOSED — gzip sitemap with size caps |
| AIDE-CRAWL-006 | CLOSED — origin lock unchanged on crawl fail; statuses split |
| AIDE-CRAWL-007 | CLOSED (code) — recrawl sweep on job worker, not widget ping |
| AIDE-CRAWL-008 | CLOSED — crawler DNS-pinned transport |
| AIDE-CRAWL-009 | CLOSED (code) — failed recrawl does not call knowledge sync |
| AIDE-CRAWL-011 | CLOSED (code) — per-agent Redis crawl lock TTL + token |
| AIDE-CRAWL-012 | CLOSED — quality skip reasons (soft 404, login, maintenance, cookie wall) |
| AIDE-CRAWL-013 | CLOSED — structured crawl events |
| AIDE-CRAWL-014 | CLOSED — crawl-before-embed copy |
| AIDE-CRAWL-015 | CLOSED (code) — rendered DOM `a[href]` enqueue |
| AIDE-OPS-001 | CLOSED — crawl_started/completed/failed + counters |
| AIDE-UX-001 | CLOSED |
| AIDE-UX-002 | CLOSED (progressive Advanced on tools) |
| AIDE-UX-003 | CLOSED (Studio composer default; GraphQL banner) |
| AIDE-UX-004 | CLOSED (owner crawl status language) |
| AIDE-UI-001 | CLOSED (Studio starts on conversation) |
| AIDE-UI-002 | CLOSED |
| AIDE-PERF-001 | CLOSED (HTTP fetch pool size 3) — not load-profiled against a live site |
| AIDE-PERF-002 | ACCEPTED — no unbounded Chromium; render cap 25 |

## C. CRAWLER FINAL ARCHITECTURE

```text
owner URL
  → HTTPS + SSRF + DNS pin (TLS SNI preserved)
  → robots.txt
  → sitemap.xml / sitemap.xml.gz / robots Sitemap: / sitemap index (nested cap)
  → owner seed URLs
  → HTTP fetch pool (concurrency 3)
  → extract text + hrefs
  → quality / private / contentHash / canonical filters
  → useful HTML? index
  → thin SPA shell? mark needs_render
      → Playwright worker (CRAWL_BROWSER_ENABLED, max 25 pages)
      → same-origin navigation only
      → HTTPS CDN subresources allowed; private/metadata/file/ftp blocked
      → extract rendered text + a[href] (+ #/ hash routes)
      → enqueue / index
  → sync knowledge only on success
  → recrawl sweep every 15m on job worker (Redis lock)
```

Browser is fallback, never default-all.

## D. SPA TEST RESULT

| Case | Result |
| --- | --- |
| CRA empty `#root` | PASS `test:crawl-spa-detect` |
| Vue-style empty `#app` | PASS |
| Hash `#/pricing` vs `#features` | PASS |
| Gzip sitemap discovery | PASS `test:crawl-discovery` |
| Duplicate shell contentHash | PASS |
| Canonical duplicate | PASS |
| Live React CSR site through Chromium | EXTERNAL_BLOCKED (needs `CRAWL_BROWSER_ENABLED=1` + Chromium worker) |
| SSR Next HTML | Covered by HTTP path + discovery fixture (not a live next.js site) |

## E. SECURITY RESULT

| Control | Result |
| --- | --- |
| MCP PEP public READ + accessClass | PASS `test:mcp-embed-policy` |
| Missing accessClass / get_me / WRITE | deny / confirmation |
| ACCOUNT_READ | IDENTITY_REQUIRED (not auto-run) |
| Crawler DNS pin + redirect origin | PASS `test:crawl-transport` |
| Private IPv4 / metadata hostname | PASS spa-detect browser target helper |
| Redis rate-limit fail-closed | PASS |
| Crawl lock fail-closed when Redis on | PASS `test:crawl-queue` |
| Tenant / confirmation / idempotency | Unchanged (no rewrite) |

## F. UX RESULT

- Knowledge: enter URL → Crawl now; embed is separate
- Owner statuses: Ready / Crawling / Partially indexed / Failed / Needs attention
- Studio: composer first; banner when website knowledge is missing
- Tools: mapping under Advanced; GraphQL “fixed operation” stays visible
- Inbox remains the human desk label

## G. PERFORMANCE RESULT

HTTP crawl uses a bounded pool of 3 fetches. No live timing vs sequential crawl was recorded in this pass. Browser concurrency stays 1 page at a time, max 25 pages.

## H. TEST RESULTS

Commands run this pass:

```bash
node scripts/test-limits-ssot.mjs                          # PASS
node scripts/test-gap-protocol-adapters.mjs                # PASS
node --import ./scripts/register-aliases.mjs scripts/test-mcp-embed-policy.mjs  # PASS
npm run test:crawl-discovery                               # PASS
npm run test:crawl-spa-detect                              # PASS
npm run test:crawl-queue                                   # PASS
npm run test:crawl-transport                               # PASS
npm run test:rate-limit-failclosed                         # PASS
npm run test:production-gaps                               # PASS (limits, protocols, redis, MCP PEP, F11-B)
npm run build                                              # PASS
```

`test:full-user-flow-browser` and live Phase 12 were not re-run in this finishing pass.

## I. BUILD

`npm run build` — PASS (Next.js 16.3.0, compiled successfully, 128 static pages generated).

## J. EXTERNAL ITEMS

- OpenAI live spend
- Hosted web search live
- Resend verified domain
- SafePay webhook
- Production Redis + BullMQ worker process
- Chromium on crawl worker (not Vercel serverless)
- Production `preflight:production`

## K. GO-LIVE CHECKLIST

1. `REDIS_ENABLED=1` + `BULLMQ_ENABLED=1` + job worker
2. `CRAWL_BROWSER_ENABLED=1` only on a Chromium-capable worker
3. `prisma migrate deploy` including GraphQL/XML columns
4. `npm run preflight:production`
5. Crawl a static site and a SPA; confirm Studio answers from indexed pages
6. Public widget origin lock + one WRITE confirmation + Inbox handoff
7. Billing entitlement + email if credentials exist

## L. NO-CHANGE CONFIRMATION

Preserved: AUTH → trusted context → orchestrator, PEP, confirmation, idempotency, GraphQL stored ops, XML opt-in, pagination max 2, hosted web routing, empty knowledge ≠ auto web search, admin auth, HTTP manual redirects, tool fencing, Next/Prisma/Auth.js. No TypeScript application source. No orchestrator rewrite.
