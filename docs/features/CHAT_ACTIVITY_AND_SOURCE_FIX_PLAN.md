# Live chat activity and source-name fixes

Status: Phases 1–4 implemented locally under user authorization, 2026-09-09. Phase 5 targeted follow-up: plans parsing and named search-lifecycle fixes passed real local embed retests; broader live/full-suite/production gates remain conditional. Scope: existing AIDE embedded chat and Studio, their existing SSE transport, orchestrator/gateway progress, and source presentation.

## Decision

Use actual server execution events to show short, fixed user-facing statuses while a response is being prepared. This improves transparency without another model call, polling loop, socket channel, or change to source authority. Never stream model deliberation, hidden prompts, raw tool arguments, credentials, internal endpoints, retrieved passages, or raw results as activity.

The orchestrator cannot truthfully announce the chosen tool before a model selection returns. During that interval show neutral typing or “Preparing your response”. Announce an action only after selection. Distinguish checking permission, waiting for confirmation, and actual outbound execution.

Knowledge retrieval already runs before the orchestrator in chat.service.js. FAQs are knowledge documents, not necessarily separately executed tools. Instrument the existing retrieval boundary; do not move retrieval or introduce an artificial FAQ call merely to animate the UI.

## Verified findings

| Priority | Evidence | Implication |
| --- | --- | --- |
| High | MessageList.jsx renders activity only inside msg.streaming; PublicWebchat.jsx and ChatWorkspace.jsx create that message on first delta | Running actions before the first answer token are hidden. Existing SSE events alone do not establish visible progress. |
| High | loop.js emits running before invokeOneTool, which contains policy and confirmation checks | A denied or confirmation-gated action can appear to execute although no outbound request occurred. |
| High | loop.js maps only step.status; CONFIRMATION_REQUIRED arrives with ERROR | Expected user-input pause is mislabeled failed. AgentActivityBubble defaults any non-running state to “Completed checks”. |
| High | resumePublicChatAfterConfirmation and resumeChatAfterConfirmation in lib/api/chat.js use JSON requests | The execution users actually approve has no live SSE path. |
| Medium | chat.service.js: streamKnowledgeActivity requires !publicAccess | Embedded visitors receive no retrieval progress even when knowledge is used. |
| Medium | web-search-result.js assigns Untitled source immediately; first-URL-wins dedupe drops later citation title | Proper names can be available in citations but missing from displayed source chips. MessageBubble prefers sources over citations. |
| Medium | Activity mode derives from substrings of tool names; HTTP names are suppressed; search item identity is discarded by loop forwarding | Classification can be wrong for MCP/built-ins, and multiple searches may overwrite one activity. |
| Medium | Public SSE route directly enqueues/closes and returns error.message; public stream helper has no cancellation parameter | Disconnect lifecycle needs tests; unexpected errors may expose internal details. Exposure is a risk from this code path, not a demonstrated secret leak. |
| Medium | One tool-enabled loop branch chunks an already completed response | Text animation in that branch is not provider-token streaming. Do not label all reply paths genuine token streaming. |

No new authentication bypass was demonstrated in this audit. Existing public conversation guards, policy, confirmation, idempotency, SSRF and result fencing remain mandatory. Observability must never grant authority or trigger a tool.

## Event contract and user experience

Keep the current `tool` SSE envelope for compatibility and add a validated `agent_activity` payload. Include turnId, activityId, monotonic sequence, known mode and known phase; optional safe outcome code. IDs correlate a turn and an invocation, not a public database record or resource ID. Use trusted descriptors for HTTP/MCP/built-in modes, and provider item IDs mapped to opaque activity IDs for searches.

Phases: selected, validating, running, needs_confirmation, needs_identity, completed, failed, cancelled. Cache/replay outcomes must be described as reuse, not a new outbound call. Rendering labels come from an application-owned allowlist; do not display arbitrary owner/model/provider strings.

Normal generation retains typing dots before the first text delta. An active operation replaces or accompanies those dots with a compact status. Completed work may remain in a small per-turn activity list while answer text streams. Confirmation displays “Waiting for your confirmation”; a failed or cancelled action must never be summarized as successful. No fake percentages, artificial delays, or claims that internal reasoning is being streamed.

## Implementation phases and gates

### Phase 1: Event state and source normalization

Implementation: `lib/chat/activity-state.js` supplies an allowlisted event normalizer, per-turn reducer, fixed labels and bounded storage (32 activities). At the Phase 1 checkpoint this was not yet wired to emitters or UI; Phases 2–3 below now supply that integration. New clients ignore legacy activity payloads without valid turn IDs/sequences and retain neutral typing when valid activity is unavailable.

`lib/services/ai/web-search-result.js` now merges meaningful titles, falls back to hostnames, preserves URL path/query case, rejects embedded URL credentials/overlong links and removes title control characters. HTML-like titles remain plain text for React's existing escaping; they must never be rendered as HTML. Signed query links need a separate policy decision; no query stripping or server title-fetching was introduced. Existing persisted conversation sources are not backfilled.

Verification: the source regression reproduced title loss before the change. All 10 focused tests in `scripts/test-chat-activity-sources.js` and `scripts/test-chat-activity-state.js` passed afterward; existing web-search Phase 1 and Phase 3 checks and focused ESLint passed. Live first-token UI verification is explicitly pending Phase 3, not inferred from pure reducer tests.

- Add a small pure activity validator/reducer with per-turn isolation, duplicate handling, monotonic updates and bounded storage.
- Merge source metadata by URL, prefer a meaningful citation title over placeholder text, and use the hostname only when no title exists.
- Preserve existing safe-link handling. Do not fetch arbitrary source pages to discover titles (would introduce outbound/SSRF work).
- Avoid lowercasing URL paths/query strings for dedupe: those can be case-sensitive. Apply bounded title and URL validation; reject credential-bearing or malformed links, and assess signed/sensitive query handling separately from ordinary public citations.

Tests: reproduce existing title-loss and first-token visibility failures first; title ordering in both directions, missing titles, duplicate URLs, case-sensitive paths, hostile titles, unsafe URLs, unknown phases, duplicate/out-of-order events and stale-turn events. Gate: pure contracts pass without changing tool authorization.

### Phase 2: Accurate emission boundaries

Implemented: chat assembly wraps activity in per-turn opaque IDs, monotonic sequences, bounded state and allowlisted labels. Public and Studio retrieval emit running/completed with an empty-result outcome; model preparation ends on the first action/text event, completion or failure. HTTP running now originates immediately before fetch, after gateway checks, queue acquisition and executor validation/SSRF. MCP running originates after gateway/server limits, credentials and URL checks before connection initialization. Internal built-ins remain selected/validating followed by their actual outcome; no artificial outbound-running event is added for local work.

Action metadata determines HTTP/MCP/built-in modes. Hosted search item IDs map to distinct opaque activity IDs. Confirmation/identity pauses, failures, timeouts, no-result, cache and both gateway/in-turn replay outcomes are distinct. Activity callbacks cannot throw into the authorized operation. No provider calls, limits, source routes, schema or authorization gates were added or relaxed.

Verification (2026-09-09):

- `node --experimental-default-type=module --test scripts/test-chat-activity-emission.js scripts/test-chat-activity-state.js scripts/test-chat-activity-sources.js`: 14 tests pass. Real executor code with mocked transports checks request validation, SSRF rejection, dispatch ordering, timeout mapping, cancelled MCP and callback-failure isolation.
- `./node_modules/.bin/tsx --import ./scripts/register-aliases.mjs scripts/test-chat-activity-gateway.js`: 12 HTTP/MCP gateway cases pass against a fixture database: disabled/wrong-agent, missing identity/token and confirmation-required paths have zero dispatches and preserve audit writes. Initial top-level-await harness startup was blocked; wrapping the script entry in async main fixed the harness and the captured rerun passed.
- `npm run test:openai-web-search-phase2`, `npm run test:openai-web-search-phase3`, `npm run test:orchestrator`, focused ESLint and `npm run build`: passed. Existing suite checks include static wiring assertions; they are not live provider evidence.

Not verified in this phase: browser-visible pre-token progress, live MCP/provider execution, real database confirmation consumption/replay and public retrieval timing end-to-end. These remain the Phase 3–5 gates below; do not claim full-suite or production acceptance from these focused checks. Confirmation resume still uses JSON until Phase 4.

- Emit retrieval progress from chat assembly for Studio and public embed after the existing access checks, with no document names/contents in public activity.
- Emit neutral preparation while routing/model selection is pending; never invent which source will be selected.
- Keep selection in the orchestrator. Carry an optional safe callback through the existing gateway; emit running at actual dispatch, after policy/identity/confirmation and queue acquisition.
- Normalize capability outcome codes for confirmation, identity, denial, failure, cached/replayed results and success.
- Preserve a distinct activity for each web-search provider call and each authorized HTTP/MCP invocation.

Tests: ordinary reply, knowledge hit/empty result, public retrieval, HTTP/MCP allow/deny/timeout, missing identity, confirmation pause, replay and repeated search calls. Assert no outbound-running event on blocked operations, no extra provider calls, no changed limits or source routes. Gate: events reflect actual boundary order and contain only allowlisted fields.

### Phase 3: Shared live UI

Route correction found during implementation: `/agents/[id]/test` renders `components/studio/AgentTestStudio.jsx`, not ChatWorkspace. AgentTestStudio still used JSON-only `sendChatMessage`. It now uses the existing SSE/JSON-fallback helper and the shared activity hook; its question-run results, logs, knowledge metadata and confirmation UI remain intact. ChatWorkspace is also migrated, but its component tests alone must not be called real Test Studio coverage.

Implemented: MessageList renders activity before the first assistant delta as well as during text streaming. Normal preparation keeps typing dots. `hooks/use-chat-activity.js` binds events to the locally owned request and server turn, using the Phase 1 bounded reducer. Reset/history changes invalidate old stream callbacks; partial failed streaming messages are removed. AgentActivityBubble uses fixed labels, per-action outcomes, existing Spinner and widget theme tokens, with wrapping and reduced motion. It never labels confirmation/failure as completed or renders provider-supplied labels. Embed desk refreshes crossing a send boundary are ignored, and surviving messages retain local confirmation metadata when a refresh omits it.

Verification: `ACTIVITY_BASELINE=1 node scripts/test-chat-activity-browser.js` reproduced the missing pre-token activity with the HEAD MessageList. `npm run test:chat-activity-browser` passed six scenarios: PublicWebchat, ChatWorkspace and the actual AgentTestStudio, each in light/mobile and dark/desktop. Tests mount real components and the real SSE parsers in Chromium with a controlled ReadableStream, mocked API data and Next navigation shells—no database, real auth or paid providers. They cover pre-token visibility, typing dots, all activity modes, text, confirmation controls, malformed/stale-turn handling, reset/late replies, error cleanup, done, JSON fallback, viewport overflow and reduced motion. Synthetic screenshots are generated under ignored `.tmp/chat-activity/`; these are local artifacts, not committed acceptance evidence.

Existing web-search Phase 2/3, orchestrator, F05 Studio and F12 desk checks passed. Focused ESLint has no errors; existing effect/dependency warnings remain. Production build passed. Live provider timing, real socket fanout/refresh races and approved confirmation execution are not established by this component harness; retain Phase 4–5 gates.

- Render activity independently of the existence of an assistant text message in MessageList.
- Use the reducer in PublicWebchat and ChatWorkspace, scoped to the active turn.
- Preserve text streaming, confirmation controls, input state, errors and persistence; prevent older requests/realtime refreshes from overwriting the current turn or removing confirmation controls.
- Use polite accessible status announcements for meaningful transitions, not every token; check light/dark, narrow widths and reduced motion.

Tests: hold a mock stream before its first delta and assert running status is visible; then deliver text/done/error. Check plain typing dots, all action modes, concurrent activities, confirmation and error labels. Gate: browser confirms visible progress before the first answer token in both embed and Studio.

### Phase 4: Confirmation resume and disconnects

Implementation: `lib/api/chat.js` sends normal messages and confirmation resumes through the same bounded SSE/JSON reader (`lib/chat/read-chat-response.js`). Public resumes retain their conversation capability and identity. Embed, ChatWorkspace and the actual AgentTestStudio display resume activity/deltas, remove partial temporary messages on failure, and abort obsolete requests on reset/unmount. Confirmation cards retain the server-approved status if subsequent execution fails; concurrent decisions are rejected while a turn is active.

Both chat routes use `lib/chat/server-stream.js`: guarded enqueue/close/cancel, 1 MiB server buffering, a 60-second transport deadline and allowlisted safe error messages. The client bounds individual buffered data to 1 MiB and total stream data to 4 MiB, has a 65-second request deadline, releases its reader, and never automatically retries. These are transport bounds, not changes to the frozen 25-second tool loop or individual provider timeouts.

Cancellation reaches the HTTP/MCP dispatch boundary: undispatched work and later retries are blocked. Already-dispatched writes retain their bounded completion/idempotency handling; cancellation does not roll them back. Existing confirmation authorization, one-shot consumption and write-idempotency authority are unchanged. Approval itself may commit even if the browser resets before resume; inspect canonical conversation/action state before retrying.

Verification: 21 pure activity/source/transport tests passed (including 7 lifecycle tests via `npm run test:chat-stream-lifecycle`); 12 fixture gateway denial/identity/confirmation cases passed with zero dispatches. `npm run test:chat-activity-browser` passed all six embed/workspace/Studio light/dark component scenarios, now including approved resume progress before tokens, one resume request, capability forwarding, reset reader cancellation and JSON fallback. Existing web-search Phase 2/3, orchestrator, F05 and F12 checks passed. Focused lint: zero errors, five existing warnings.

Production build passed for the transport/resume implementation. Final concurrent-confirmation guard and emitted-error sanitization adjustments were subsequently verified with the browser suite, lifecycle tests and focused lint; build was not repeated after those small adjustments. Targeted diff whitespace checks passed.

Gate remains conditional: component/transport mocks do not prove real DB confirmation expiry, subject/capability rejection, consumed-confirmation replay, remote write persistence after disconnect, authenticated account switching or real MCP/provider execution. Carry these explicitly into Phase 5; no full production acceptance or automatic reconnect/token replay is claimed.

- Extend the existing authenticated/public streaming helpers to support approved resume with current conversation capability and identity. Preserve one-shot confirmation consumption and write idempotency.
- Add AbortSignal handling and turn ownership on client reset/unmount; remove stale status on terminal outcomes.
- Make enqueue/close/cancel handling safe and bound any buffered events; normalize public errors to stable safe messages.
- Cancellation must not imply a dispatched write was undone, nor allow an unknown write to resend. Reconnect uses canonical persisted conversation/confirmation state; no automatic write replay and no promise of resumable token history.

Tests: confirm/deny/expire/replay, wrong subject/conversation capability, close/reset during search, timeout, partial response, missing done, disconnect before/after write dispatch and late prior-turn completion. Gate: no duplicate writes, stale activity or internal-error leakage in tested paths.

### Phase 5: Real AIDE acceptance and handoff

Follow-up: the plans failure was raw JSON truncation before projection, not an established MIME/credential fault. Bounded upstream parsing now precedes projection/schema/redaction and the existing output caps. Named selected/completed labels preserve action identity when fast search events coalesce; no fake running delay. Search/plans live rerun passed 2/2, including confirmed plans execution and replay denial. Twenty-seven focused tests, six browser-component scenarios, related regressions, focused lint and build passed. See the audit's follow-up section for exact scope and residual limits; the historical checkpoint below is not the latest result.

Live checkpoint: see [Phase 5 audit](../audits/chat-activity-phase5-local-2026-09-09.md). Actual homepage embed batch: four of six scenarios passed; plans returned CONTENT_TYPE_INVALID and search running visibility was missed when running/completed arrived together. A supplemental search run passed but had only ~15 ms between running/completed, so reliable visibility is not signed off. Public missing/forged capability rejection and consumed signup confirmation replay rejection passed. Signup and maintenance confirmed GETs showed activity before streamed text. MCP is unverified (zero configured servers). Build, six component-browser scenarios and focused regressions passed; live/full-suite/production acceptance remains conditional. No configuration/data cleanup or PR/push performed.

- Test the existing AIDE Support Assistant on the actual local homepage embed: product explanation, FAQ/PDF and embed help, real public signup/plans/maintenance tools, exact “search on internet” competitor question, and current external embedding instructions.
- Verify knowledge-only answers do not search unnecessarily and web-search-off denies search deliberately.
- Exercise an existing authorized MCP fixture if available; otherwise record live MCP as unverified, not passed from a mode-label test.
- Capture sanitized SSE timing and browser screenshots/assertions: actual activity before first delta, correctly named sources, final answer and correct confirmation state. Independently report unrelated pricing CONTENT_TYPE_INVALID and incorrect signup wording; this activity patch does not automatically fix answer grounding.
- Run focused regression, source routing, orchestrator and affected browser tests; run lint/build for the implementation. Record unrelated legacy harness failures explicitly.

Gate: report concrete passes/failures and remaining manual/live-provider gaps. Do not claim full production readiness from mock streams. No PR/push until requested.

## Rollout and rollback

No new tables, Redis keys or socket topology required. Additive payloads remain readable by older clients; new clients retain JSON fallback and neutral typing when events are unavailable. Roll out server emitters then UI consumption (or atomically in the same Node deployment). Roll back the display/emitter additions without disabling chat access checks or confirmations. Verify no new paid model requests, excessive status emissions, or chat latency regression under the same workload. Streaming and hosted-search flags remain separate deployment controls and should be reflected accurately in operational documentation.
