# Embed stability, welcome screen, history and public knowledge

Status: implementation authorized, 2026-09-09. Phase 0 host regressions and Phase 1A host foundation implemented/tested locally; remaining Phase 0 UI fixtures and Phase 1B coordinated geometry are pending. The user approved the plan with the public-page scope expansion below. No PR, commit or push.

Companions: [architecture freeze](../ARCHITECTURE_FREEZE_STAGE6.md), [activity/source plan](CHAT_ACTIVITY_AND_SOURCE_FIX_PLAN.md), [local activity audit](../audits/chat-activity-phase5-local-2026-09-09.md).

## Outcome and scope

- Keep the floating launcher at a stable viewport corner through initialization, open/close, history, proactive messages and streamed replies.
- Show a compact welcome screen to a visitor without a usable active conversation. Offer Start conversation, not an empty inbox. Returning visitors can continue or view permitted history.
- Use the same launcher location for the chat icon when closed and an X when open. Animate the panel without remount jumps, resize feedback or lost drafts.
- Open a historical thread at its latest message without visibly travelling through its transcript. Do not drag readers back down when they scroll up.
- Answer public AIDE questions from current, grounded product facts. Make public-page ingestion and missing-knowledge behavior explicit; do not automatically turn every pricing question into an HTTP call.
- Crawl all discoverable, permitted public content pages of the owner-approved site, not only pricing/help pages. Authenticated/private content is excluded. Coverage must be reported, not assumed.
- Preserve live activity, confirmation, human handoff, identity isolation and the frozen gateway/security path.

This is not a full redesign of Studio, Inbox or the landing page. Shared component changes require regression tests there. Container/full-page embeds must not inherit floating dimensions or an unwanted launcher.

## Evidence from this inspection

| Finding | Evidence | Confidence / consequence |
| --- | --- | --- |
| Frame-size negotiation is circular | `PublicWebchat.jsx` measures the child, adds 4 px, and posts dimensions from layout effect, animation frame and ResizeObserver. `app/embed.js/route.js` applies them immediately; child sizing also depends on iframe viewport | Confirmed code path; can cause repeated resize and clipping. An infinite loop is not demonstrated |
| Startup moves the launcher | Host starts at 56x56, child reports 60x60. Host initially uses bottom-right, then asynchronous ping can replace the anchor | 4 px movement observed locally; configured-left late switch is code-derived, not exercised in this run |
| Open/close has no exit lifecycle | `ChatWidget.jsx` uses `open ? panel : null`, and puts panel and launcher in one flowing column | Confirmed; panel immediately mounts/unmounts and changes the measured frame |
| Open icon is unchanged | Both open and closed default launcher branches render MessageCircle | Confirmed; aria-label changes but visual icon does not |
| History scroll is unconditional | `MessageList.jsx` calls `scrollIntoView({behavior: 'smooth'})` in an effect on last-message ID/loading/typing changes | Confirmed source of history fly-through; no reader-intent check. Same-ID token growth is not covered by its scroll key |
| History can use the wrong capability | `openPastChat(id)` sends the active `realtimeAccessTokenRef.current`; storage already keys capabilities by agent + conversation | Confirmed mismatch risk; selecting another thread can fail closed. No cross-conversation access bypass demonstrated |
| Host identity uses wildcard delivery | `pushUserToFrame` sends the normalized user, potentially including accessToken, with targetOrigin `*` | Confirmed unsafe delivery pattern. Inbound frame messages already check origin and source; those checks must remain |
| Crawl transport needs hardening | `site-crawler.js` uses redirect `follow`, only checks some literal loopback names, and reads full `arrayBuffer()` before slicing to MAX_HTML_BYTES | Confirmed missing per-hop destination/streaming-byte enforcement in this helper. SSRF/resource-exhaustion exposure needs controlled negative tests; no live exploitation performed |
| Own-site and localhost crawling is skipped | `shouldSkipCrawlOrigin` skips localhost, non-HTTPS and own-product; `embed.service.js` returns without queuing | Confirmed. Do not remove these checks just to make local testing work |
| Browser-rendered pricing is absent from crawl HTML | `LandingPlans.jsx` initially has no plans and fetches `/api/billing/plans` in useEffect; crawler strips scripts and does not run JS | Confirmed implementation gap; publicly visible does not mean present in fetched HTML |
| Knowledge is read before tools, but is not a sufficiency gate | `chat.service.js` selects chunks, then offers source-filtered actions; retrieval presence does not prove an answer is supported | Confirmed. Prompt guidance alone does not enforce KB-first for answerable public questions |

Previous scoped database inspection found two TEXT documents, no WEB document, no crawl origin/time and no numeric plan prices for the AIDE Support Assistant. That is prior-turn evidence, not a fresh database assertion here.

### Local browser evidence

Headless Chromium, actual homepage at `http://localhost:3000`, 1366x900, existing embed, no chat sent or tool approved. Homepage returned HTTP 200. A single open/close cycle produced:

| Sample | Host iframe (x,y,w,h) | Launcher (x,y,w,h) |
| --- | --- | --- |
| Initial closed | 1294,828,56,56 | 1294,828,56,56 |
| Immediately after open | 1290,824,60,60 | 1614,1356,56,56 |
| Open settled | 966,292,384,592 | 1290,824,56,56 |
| Closed again / settled | 1290,824,60,60 | 1290,824,56,56 |

Measurements are sequential DOM samples, not frame-accurate video. The outside-frame immediate launcher rectangle supports the resize-order defect; do not infer its exact visible duration. Long-duration drift, mobile keyboard and transformed-host cases are still untested.

## Product decisions

### Welcome and launcher

Use the reference's hierarchy, not its unverified staffing claims:

```text
Agent avatar + configured name
Need help?
Configured short description

[ Start conversation → ]       new visitor / no usable active thread
[ Continue conversation → ]    valid returning thread
  View past conversations      only when history is enabled and available

                             (X) fixed launcher while open
```

- Retain AIDE/agent branding, existing font, theme tokens and minimal shadow. No new font or palette system. Use existing Card/Button/brand primitives and semantic widget colors.
- Do not show fake staff avatars, “We are online”, or reply-time promises without actual staffing/SLA data. Only link a knowledge centre if an owner-configured safe public URL exists; do not invent one or expose internal Knowledge routes.
- “First visit” means no valid active thread in the current agent + visitor/verified-subject context. Resolve existing history before presenting the CTA to avoid Start/Continue flashing. Storage contents are UI hints, never authorization.
- Start conversation enters the current greeting/composer view. Do not create a server conversation, call an LLM or consume message quota merely by opening the panel or clicking Start; preserve first-send creation semantics.
- Closing and reopening within a mounted page resumes the current screen/draft. Reload respects existing session/reset/24-hour active-history rules. Do not extend retention silently.
- X returns to the original configured avatar/chat/custom launcher when closed. Support keyboard activation, aria-expanded/controls, Escape and focus restoration. Hidden panel must be non-interactive and inaccessible to tabbing.
- Adopt a short 160–220 ms opacity/transform transition, anchored at the configured lower corner, with a small translation/scale and no bounce. Disable spatial animation for reduced motion. Do not animate iframe width/height on every content update.

### Stable layout contract

The host owns viewport placement and frame bounds; the child owns visual panel transitions. Define versioned, bounded messages with desired state, transition generation and validated anchor/dimensions. Do not trust arbitrary CSS from a message.

1. Resolve a validated initial anchor before revealing the launcher, with a bounded neutral loading state and deterministic fallback if configuration fails. Do not show right and then jump left.
2. Use one fixed launcher inset/size in host and child. Account explicitly for the shadow gutter, safe areas and 12 px panel gap; remove unexplained additive size inflation.
3. Opening: expand the host frame to deterministic viewport-clamped bounds, acknowledge that generation, then animate the child panel. Do not render a 380 px panel inside the old 60 px frame.
4. Closing: keep expanded frame during the exit transition, then shrink after completion. Rapid reversal cancels stale completion/ack messages. Use bounded recovery for lost ack/transitionend and reduced-motion immediate completion.
5. Keep the chat mounted after first use to preserve draft/scroll. Closing hides, not resets or retries, an in-flight turn. Existing bounded streaming/abort semantics still apply on actual teardown.
6. Coalesce viewport resize updates; dedupe identical messages. Avoid a full-screen invisible iframe that intercepts host clicks. Verify click-through outside the visible widget bounds.
7. Explicitly test mobile visual viewport/keyboard, resize/orientation, safe-area insets, left/right placement and transformed host ancestors. A body-level fixed iframe is present already; merely adding another fixed declaration is not the fix.

### History and scroll ownership

- Separate initial thread restoration, explicit user jump, live-edge following and older-message reading. One scroller owns these modes.
- On initial/history load position at latest without smooth traversal before revealing the loaded thread. Reserve media dimensions or use the scroller's anchoring so late images do not displace it.
- Follow streaming only while the user is at the live edge. If scrolled up, preserve position and offer Jump to latest; do not scroll because typing/loading toggled.
- Look up the target thread's capability before its request; never reuse the active thread token for a different ID. Missing/expired access gets a clear unavailable/reauth state; no guessed token or weakened guard.
- Protect A→B→A selection races with a dedicated history request generation/abort mechanism. Commit conversation ID, messages, capability and desk/realtime state together only for the current selection.
- Reuse an existing verified scroller if available; none named MessageScroller was found under `components/ui` in this inspection. The shadcn skill calls for evaluating its MessageScroller primitive before inventing another manual scroll observer. Validate actual installed-compatible APIs and dependency impact in the phase; do not migrate all bubble markup or install a package blindly.

## Public pricing: what should happen?

The browser's rendered page is not automatically in the model context. Even public data must arrive via a bounded source: indexed knowledge, server-provided public facts or an approved read capability. “No knowledge and no data lookup” would leave the agent guessing.

The primary source is the site's public pages: homepage, product/features, pricing, docs, FAQ, about, contact, policies and other discoverable public content. Pricing is one part of this site-wide knowledge, not the only synced source. For AIDE's JavaScript-loaded plans, reuse `listPublicBillingPlans()` in `lib/billing/plans.service.js` to produce public HTML the crawler can read; do not introduce a pricing-only replacement for public-page crawling or send the host DOM directly to the model.

| Question / evidence state | Planned behavior |
| --- | --- |
| What is AIDE? / documented setup / public FAQ | Answer from sufficient selected public knowledge with provenance |
| What plans do you offer? with fresh complete catalogue snapshot | Answer from public catalogue knowledge; no redundant HTTP tool or confirmation |
| Exact current price, stale/missing catalogue, or explicitly requested refresh | Use the configured public READ capability if policy allows; otherwise state limitation and link canonical pricing |
| My subscription / balance / invoice | Authenticated, subject-bound capability; public prices cannot answer personal billing |
| Change/cancel/upgrade subscription | Existing policy, explicit confirmation and idempotency; KB cannot authorize mutation |
| External competitor/current-web request | Existing WEB/MIXED rules and web-search switch; no silent empty-KB→web fallback |
| Ambiguous or contradictory facts | Ask a focused clarification or use an explicitly permitted current read; do not guess |

Public GET does not automatically mean confirmation-free: method alone does not prove safety. Keep current published-action confirmation settings until the owner explicitly accepts a reviewed public READ configuration change. This plan does not silently switch off the existing plans confirmation.

### Ingestion and freshness

- Discover from the approved origin, sitemap indexes/sitemaps and same-origin page links. Remove pricing/help keyword filters as coverage restrictions (they may only prioritize). Follow public pagination with canonical dedupe, query allowlisting and cycle/trap detection. Subdomains/external sites require separate owner approval. Unlinked pages require a sitemap or owner-provided public seed URLs; never claim discovery of unknowable URLs.
- Fetch anonymously: no owner cookies, credentials, bearer tokens or browser session. Exclude 401/403, login redirects, soft-login/auth-wall pages, personal/account/admin surfaces, signed/private links and robots-disallowed content. HTTP 200 or absence of an auth prompt alone is not proof content is safe to index. Login/signup forms, logout/action URLs and API routes are not public knowledge pages even when reachable anonymously.
- Process coverage in bounded, resumable batches with a persistent frontier and per-job/site budgets; do not simply raise MAX_PAGES or depth indefinitely. The existing 25-page/2-hop behavior cannot claim entire-site coverage. Mark remaining queue, skipped/blocked pages, budget exhaustion and unsupported JS-only pages as partial, with reasons and resumable next steps.
- AIDE: make dynamic public facts available in server-produced HTML while keeping interval/compare controls interactive, then include those pages in the same site-wide crawl. Scope every document/job to its authorized agent and verified site; never mix tenants.
- Index deterministic, idempotent page documents with canonical URL, source/version, content hash, crawl time and defined freshness. Re-crawl changed pages and reconcile removals without wiping unrelated manual knowledge. Invalidate relevant pricing pages on approved catalogue updates; keep last good data on failed refresh but label it stale. The phase must inventory catalogue write paths and other supported content-change triggers.
- Store existing compatible metadata where possible. If required provenance/freshness cannot fit the current schema safely, propose an additive migration, old-row defaults and rollback before implementation; do not hide structured state in arbitrary text.
- Preserve exact prices, currency, monthly/yearly intervals, limits, custom/contact and coming-soon distinctions. Do not rely on an LLM summary for authoritative numeric extraction. Avoid truncating half a pricing table; project to query-relevant complete records within existing result/knowledge budgets.
- Apply the same all-public-page scope to AIDE and customer sites. Surface queued/running/complete/partial/failed/skipped status, last update, discovered/indexed/excluded/pending counts and reasons. First embed does not guarantee all public content is indexed synchronously; complete means the permitted discovered frontier is exhausted, not merely that one batch finished.
- JavaScript-only sites: first offer a server-rendered public page, an owner-approved structured source/import, or explicit configured public READ tool. General browser-rendered crawling is deferred until isolated-browser egress, subresource/redirect/DNS controls, resource budgets, privacy and cleanup have a separately approved design. No broad localhost/private-network allowlist.

### Knowledge sufficiency and bounded routing

Keep retrieval in chat assembly and the existing STORE/WEB/GENERAL/MIXED routes. Add a documented decision within permitted capabilities for sufficient public answers, live requirements, missing evidence, stale evidence and conflicts.

- A nonempty `selected.used`, lexical score, or generic “billing” paragraph is not proof of sufficient pricing evidence.
- Define answer requirements and evidence completeness tests for public catalogue/FAQ intents, including requested interval/currency/limits. For uncertain free-form questions, retain an explicit insufficient/ambiguous state; do not claim universal factual sufficiency detection.
- Filter redundant public lookup actions only for a supported sufficient-answer decision; enforce the decision at the canonical gateway as well as prompt/tool offering. Model prose and knowledge cannot manufacture the decision or authorize a call.
- No retrieval→tool→retrieval recursive fallback. Retrieval once per decision stage, existing tool step/deadline/concurrency caps, at most the explicitly permitted current lookup path. Empty/failed lookup ends safely, not endless retry/search.
- Emit only existing allowlisted activity statuses for actual work. A cache hit is not a web search; no fake progress durations or hidden reasoning.
- Record the source-precedence decision as a Stage change note before implementing it. This plan does not itself unfreeze routes, authorize new privileged adapters, or allow bypassing PEP/result fencing.

## Priority risks and required negative tests

No confirmed critical exploit or production incident is claimed. These are blockers to expanding the relevant feature:

1. **High: identity wildcard postMessage.** Restrict to exact embed origin, keep source-window validation, validate bounded envelopes. Test an iframe navigated away receives no subsequent identity payload; wrong origin/window cannot resize, close or supply identity. Use synthetic credentials only.
2. **High: crawl SSRF and memory limits.** Audit all crawl entry paths; enforce destination checks on initial URL, DNS resolution and every redirect, public HTTPS/allowed port rules, bounded redirects and streaming byte limits before buffering. Test loopback, private/link-local IPv4/IPv6, mapped IPs, credential-bearing URLs, rebinding, redirect loops, compressed/oversized bodies and timeouts with controlled fixtures, never real metadata endpoints.
3. **High: source poisoning/privacy.** Host Origin/Referer are not proof of domain ownership against non-browser callers. Before expanding automatic ingestion, review first-claim binding and owner/domain approval. Never index auth/session pages, private JSON, request credentials, scripts or arbitrary host DOM. Prompt injection remains untrusted data.
4. **High functional: historical token/race mismatch.** Test A/B thread capability isolation, expiry, missing token, guest→user/logout/account switch, stale fetch completion and socket-room reconciliation. Do not leak previous user's preview or message state.
5. **Medium: resize feedback and stale transition messages.** Test rapid repeated toggles, delayed config, changed anchor, delayed fonts/avatar, proactive message, route navigation and duplicate script initialization. The loader currently removes other-agent iframes; preserve/document single-widget behavior, not a silent multi-agent feature change.
6. **Medium: stale/incomplete facts and refresh storms.** Deduplicate crawl/sync jobs across instances, bound retries/backoff, prevent per-message recrawls and cache stampedes. Test partial crawl, deleted prices, conflicting docs and missing fields without invention or raised caps.

## Sequential implementation phases

Every phase ends with its focused tests, diff review and captured results before the next starts. Failures block progression unless explicitly identified as an unrelated baseline and accepted. Missing infrastructure/provider credits are BLOCKED/SKIPPED, never PASS.

### Phase 0 — Reproduction and contracts

Create repeatable local JS Playwright fixtures for frame geometry, delayed config, rapid toggle, long history and live-edge state. Preserve the real browser measurements above as baseline. Finalize welcome lifecycle, host/child message contract, source precedence Stage note and security test fixtures. No paid provider calls necessary.

Gate: reproduce initial anchor drift, open clipping, missing X and history smooth traversal; measure launcher screen coordinates across frames. Record current tests/dirty-worktree baseline and verify fixture startup before assertions.

### Phase 1 — Embed transport and stable placement

Harden exact-origin identity messaging and bounds validation. Implement host-owned geometry, initial anchor agreement, resize dedupe and opening/closing acknowledgements. Keep same public snippet/API aliases and floating/container/full-page compatibility. Audit loader cleanup/duplicate listeners on remount.

Implementation batches: **1A** preserves the current child envelope while fixing host identity delivery, startup size/anchor, bounded dimensions, resize dedupe and cleanup. **1B** adds the coordinated versioned host/child opening/closing protocol, replaces the measured-size feedback/gutter contract, and verifies visual-viewport/safe-area behavior. Do not call Phase 1 complete after 1A alone.

Gate: wrong origin/window, malformed/oversized dimensions, lost/stale ack, navigated frame, duplicate init; delayed left/right anchor; no clipping and no drift beyond 1 CSS px after configuration at fixed viewport. Verify mobile viewport/safe areas and outside-widget clicks. Run existing embed-readiness and embed browser regressions with isolated fixtures.

### Phase 2 — Welcome and motion

Implement welcome/continue/history states, consistent X toggle, reversible opacity/transform animation and draft-preserving hidden panel. Use existing theme/brand and UI primitives; preserve transcript/confirmation styles. No schema change needed just to show welcome UI.

Gate: new/returning/session-expired/storage-disabled contexts, disabled history, missing avatar/description, light/dark, long labels, 320/390/768/1440 px widths; keyboard/Escape/focus, reduced motion and rapid toggle reversal. No new chat/LLM call on open. Retest streaming/confirm while closed and reopening. Run `npm run test:chat-activity-browser` and focused lint.

### Phase 3 — History correctness and scrolling

Fix target capability selection and atomic history transition; use a single verified scroll owner for restore/live-edge/jump-to-latest. Preserve draft, human messages, activity, error, CSAT and confirmation state across visibility changes.

Gate: long thread opens at latest without smooth fly-through; token-by-token growth follows only at bottom; user scroll-up is respected; media/font settling, empty/error history, pagination if supported, rapid A/B/A requests, auth/capability negatives and identity switch. Regression across public embed, ChatWorkspace and Studio; `npm run test:chat-activity-browser`, relevant realtime tests and focused lint.

### Phase 4 — Secure public facts and ingestion

First harden crawl transport and test it. Then implement all-public-page discovery, durable bounded/resumable frontier, per-page knowledge/provenance and coverage states for the approved site. Make AIDE's dynamic public plan content server-readable as part of that crawl. Establish an explicit owner-approved own-site binding without opening arbitrary localhost crawling. Do not turn on unrestricted JavaScript execution.

Gate: security negatives above, sitemap indexes, non-help public pages, pages beyond the first 25 and second hop across batches, duplicates/query traps, robots exclusions, auth redirects/soft-login pages, credential-free requests, restart/resume, tenant isolation, concurrent refresh/dedupe, removed pages and stale/partial/failed ingestion. Check exact interval/currency/limit equality between catalogue, landing and document. Verify HTML contains actual plan facts without executing JS. JS-only content must either be made crawlable through the approved approach or explicitly reported unsupported/partial. Run `npm run test:f08`, `npm run test:crawl-schedule`, `npm run test:embed-readiness`, relevant billing-plan regressions, lint and build. Review any additive migration separately before applying it.

### Phase 5 — Explicit evidence-first answers

Implement the accepted sufficiency/freshness decision and redundant-read filtering through existing boundaries. Preserve live/account/write routing, action confirmation settings and real activity. Use small complete projections to avoid truncated pricing answers. Document stable safe diagnostic decision codes without raw transcripts/results.

Gate: “What is AIDE?”, FAQ, fresh plans (zero redundant tools), generic billing KB without prices (insufficient), stale plans, explicit latest pricing, personal subscription, write request, ambiguous plan/interval, external web on/off, hostile KB/tool result, denied policy and provider failure. Count real outbound calls; assert no retry/fallback cycle and existing caps. Run source-policy, orchestrator, HTTP-tool, F08, confirmation/idempotency and chat-activity suites plus build.

### Phase 6 — Integrated acceptance and handoff

Use the real local homepage script embed and the authorized AIDE agent after deterministic tests pass. Test a clean guest, returning guest and verified user; startup/idle/scroll/resize/open/close/history; grounded product/plan answers; explicitly approved live public read, web search and confirmation flows. Do not approve a remote WRITE as part of UI testing.

Gate: run `npm run lint`, `npm run build`, `npm run test:product`, `npm run test:shipped`, `npm run test:full-suite` and relevant embed/realtime browser suites in isolated output directories/ports. Run opted-in `npm run test:chat-activity-live` only with approved local fixture/agent scope; it can create chats and incur provider costs. Capture final command results, source/call counts, geometry/scroll assertions, screenshots and explicit residual owner/production gates. Do not run overlapping Playwright jobs into the same artifact directory.

## Rollout and rollback

- Ship UI and public-source work as separate reviewable changes. No automatic PR/push. Leave existing dirty-worktree changes untouched.
- Host embed.js is cacheable for 300 seconds: version envelopes, retain a bounded legacy fallback, and test old-host/new-child and new-host/old-child. Advance the internal loader cache version only when compatible. A stale host must not leave the widget invisible or leak identity.
- UI rollback restores the previous panel behavior without deleting histories or changing tokens. Remove transition listeners/timers on teardown, and verify duplicate loaders/listeners are absent.
- Ingestion rollout is agent-scoped and reversible. Stop the scoped sync if needed, retain source records for audit and mark stale; never delete unrelated customer knowledge. Additive migrations remain compatible with old readers.
- Source-decision rollback restores prior offering rules, not policy bypass. Verify no new adapter/tool remains accidentally enabled, no background job repeats indefinitely, and previously published confirmations remain valid under their existing contract.
- General browser-rendered crawling, global auth changes, WRITE confirmation changes, vector RAG and production cutover remain outside this plan.

## Original planning checkpoint

Completed: relevant source/docs/skills inspection, git status inspection, localhost HTTP check and one real Chromium open/close geometry reproduction. Only this plan file was added. No fixes or full-suite PASS claimed. Design skills informed the restrained welcome hierarchy, reuse of theme/components and single-owner scroll proposal.

## Implementation checkpoint — Phase 0 host tests + Phase 1A, 2026-09-09

Changed `app/embed.js/route.js`; added `scripts/test-embed-host-browser.js` and `npm run test:embed-host-browser`. No UI, crawler, schema, environment or agent configuration changed in this batch.

- Identity delivery now uses the exact application origin. Existing inbound source-window/origin checks remain. Synthetic browser test navigates the iframe to another origin and confirms no subsequent identity delivery there.
- Initial frame is 60x60, matching the current child's 56px launcher + 4px measurement gutter. This is a backward-compatible bridge, not the final removal of circular measurement.
- Initial launcher reveal waits for frame/config agreement, bounded by a two-second fallback. Late ping cannot change the revealed anchor. If configuration misses that deadline, default bottom-right is retained for that instance; host/child authoritative-anchor reconciliation remains Phase 1B.
- Resize envelopes reject non-boolean state, nonnumeric/nonfinite/negative/zero/overlarge dimensions and malformed optional booleans. Dimensions are bounded against both viewport edges. Identical styles are not reassigned; viewport resize work is coalesced into an animation frame.
- Replacement/unavailable cleanup removes message/resize listeners and pending reveal/resize work. Current single-widget behavior and public aliases remain. Container embeds ignore floating geometry.

Evidence:

| Command / check | Result |
| --- | --- |
| `npm run test:embed-host-browser` before fix | 7 failed / 2 passed; reproduced 4px startup drift, late anchor movement, wildcard delivery after navigation, malformed sizes, viewport overflow and redundant style writes |
| `npm run test:embed-host-browser` after fix, expanded cases | 12/12 PASS; includes container mode, invalid anchor fallback and unavailable/re-init |
| Real localhost homepage Chromium, 1366x900 | HTTP 200; launcher x=1290,y=824,w=56,h=56 at first visibility, settled, open-settled and closed-again. No observed settled drift. Does not certify smooth transition frames |
| `npm run test:chat-activity-browser` | 6/6 PASS (embed/workspace/Studio, light/dark; fixture transport) |
| `npm run test:embed-readiness` | PASS |
| `npm run test:f14e` | PASS |
| Focused ESLint for route + new test | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| `npm run test:f14c` | Existing static-contract FAIL: `tool-loop preferEndUserAuth`; looks in legacy `lib/actions/tool-loop.js`, while current invocation wiring is in `lib/actions/invoke-tool.js`. Replaying with the original HEAD embed route in memory produces the same failure. No test weakened or unrelated auth code changed |

Not completed: full Phase 0 UI fixtures/source decision note, Phase 1B opening/closing ack protocol, smooth animation/welcome/X, history fixes, real mobile keyboard/safe-area tests, all-public-page crawling, source-policy implementation or full project suite. Existing F14-C baseline needs a separate current-boundary test review before unconditional sign-off. Phase 1 is still in progress; next work is Phase 1B, followed by welcome/motion after its tests.

The loader response remains cacheable for five minutes. Manual checks must bypass browser cache or wait for expiry; an old cached script will retain old behavior. No PR/push performed.
