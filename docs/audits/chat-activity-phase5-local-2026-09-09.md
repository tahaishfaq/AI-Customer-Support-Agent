# Phase 5: actual local AIDE embed acceptance

Date: 2026-09-09. Verdict: **conditional; not all clear**.

## Follow-up: plans parsing and named search lifecycle fixed

The two targeted issues below were fixed and retested on the actual local homepage embed. This supersedes their initial failure status, not the other remaining acceptance gates.

**Plans root cause:** `executeHttpActionOnce` truncated the raw response to the guest 1,200-character budget before calling `normalizeProjectedResponse`. The latter parsed the incomplete JSON and reused `CONTENT_TYPE_INVALID` for a parse failure. The published URL was the correct local plans endpoint; this was not evidence of an HTML response or wrong credentials. A large valid JSON regression failed before the patch and passed afterward.

The executor now reads at most 1 MiB of upstream response bytes, parses/projects/validates/redacts the bounded complete document, then applies the unchanged 1,200-character guest or 8,000-character owner output cap. Oversized bodies are cancelled with RESPONSE_TOO_LARGE. Malformed JSON, non-JSON contracts and schema mismatches still fail closed. SSRF, confirmation, credentials and retry policy were not relaxed. No tables, action revisions or environment configuration changed. Large projected output can still be truncated and marked as such; this fix does not promise every plan/price fits the model budget.

**Search presentation:** selected and completed events now retain mode-specific labels, including `Preparing web search` and `Web search completed`. When running/completed events arrive together, the UI truthfully displays completion while text streams instead of an anonymous completed check. No artificial duration, fabricated running phase, provider-call increase or answer delay was added. The six-component-browser scenarios now explicitly batch selected/running/completed before the first delta and assert the named completed state.

Targeted live rerun (`AIDE_LIVE_CASE=search,plans`): **2/2 passed**. Search delivered 15 titled sources and 242 deltas, with named selected/running/completed status visible before the first answer token. Plans required confirmation, resumed over SSE, executed the GET with OK/200, displayed HTTP activity before text and emitted 33 reply deltas. Reusing its consumed confirmation returned 400 CONFIRMATION_NOT_APPROVED. The plans screenshot was visually inspected. Complete factual accuracy of every price/feature was not audited.

The live harness now separately reports `runningLabelObserved` and asserts `namedSearchLifecycleBeforeDelta`: a very fast search is allowed to show its truthful named completion rather than fake a prolonged spinner. The initial transient-running observation is retained below; no claim is made that the provider's running interval is now longer.

Follow-up verification: 27 focused activity/source/lifecycle/HTTP-budget tests, six browser-component scenarios, HTTP-tools Phase 5, F11-R3, web-search Phase 3, orchestrator suite, focused lint and production build passed. Local evidence: `.tmp/chat-activity-live/report-search,plans.json`. No PR/push, configuration changes or customer-data cleanup performed.

## Scope and execution

Chromium visited the real `http://localhost:3000` homepage, opened its existing script-injected iframe and chatted with the existing AIDE Support Assistant. No replacement agent, mock responses, fake progress, new knowledge, credentials, configuration updates or authentication bypass were used. Fresh browser contexts isolated each scenario. This run created test conversations and approved only the existing public READ actions for signup, maintenance and plans. Test conversations were retained; no data was deleted.

The agent has three enabled, published, confirmation-gated GET actions, all configured against localhost. Five distinct real business endpoints and a live MCP server are not present; MCP server count is zero. Local HTTP checks do not establish HTTPS/TLS behavior.

The actual server returned SSE and executed hosted search. The `.env` file itself did not define `STREAMING_CHAT` or `OPENAI_WEB_SEARCH_ENABLED`; active process overrides are not persistent deployment configuration. No environment file was edited.

## Live results

| Scenario | Evidence | Verdict |
| --- | --- | --- |
| Explain AIDE | HTTP 200 SSE, 43 deltas in full run, completed relevant product answer; no search | PASS: delivery and basic relevance |
| FAQ/PDF and embed help | HTTP 200 SSE, 52 deltas, no unnecessary search | PASS: delivery and basic relevance; not exhaustive UI-instruction accuracy |
| Exact customer competitor-search question | Full run: search executed, 19 titled sources, 439 deltas. Repeat: 15 titled sources, 254 deltas, no Untitled source links | PASS: search execution and source normalization |
| Search running visibility before first text | First run: running/completed arrived together and observer saw no Searching label. Repeat: label observed before text, but running/completed only ~15 ms apart | INTERMITTENT: not reliable human-visible running progress |
| Signup availability | Correct confirmation; approved resume SSE; real GET returned OK; HTTP running label observed before text | PASS |
| Maintenance status | Correct confirmation; approved resume SSE; real GET returned OK; HTTP running label observed before text | PASS |
| Plans/prices | Correct confirmation and visible HTTP running activity; approved invocation returned CONTENT_TYPE_INVALID; final response completed | FAIL: tool result, not transport completion |
| Missing or forged conversation capability | Each rejected with HTTP 401 PUBLIC_CONVERSATION_ACCESS_REQUIRED on an actual new test conversation | PASS |
| Reuse consumed signup confirmation | HTTP 400 CONFIRMATION_NOT_APPROVED | PASS: public resume rejection; not a remote WRITE replay test |

Full six-scenario batch: 4 PASS, 2 FAIL (search visibility and plans execution). Supplemental product/search/signup batch: 3 PASS, including access/replay negatives. The second search pass does not erase the first timing failure. Product/search/signup supplemental responses each reported two used knowledge documents; that does not establish which long/short chunk grounded each claim.

Assertions check basic answer relevance, not full factual correctness. Prior inaccurate pre-confirmation signup wording and official-source-only compliance are **not cleared** by this run. No third-party competitor statements were independently fact-checked.

## Findings and next corrections

1. **Search progress is too transient to rely on.** Client-observed running/completed timing explains the missed label, but does not isolate whether provider timing, network batching or rendering caused the coalescence. Existing selected-state wording is generic (`Preparing this check`). Next fix should retain a truthful mode-specific selected/completed summary and test coalesced events. Do not fabricate a longer running duration, delay the answer, or reveal model deliberation.
2. **Plans tool still fails content-type validation.** A direct unauthenticated GET to the same local plans route returned 200 application/json, while the confirmed tool path returned CONTENT_TYPE_INVALID. This disproves a blanket claim that the public endpoint always returns HTML. Compare the published revision's resolved request and safe upstream status/content-type/redirect metadata at the executor boundary. Do not weaken JSON checks or forward owner cookies to the public tool. Root cause remains unproven.
3. **Configuration persistence remains an operational gate.** Verify streaming/search settings in the actual deployment secret/config manager; a successful overridden local process is not production cutover evidence.

## Automated checks rerun

- `npm run test:chat-activity-browser`: six real-component Chromium scenarios passed with controlled streams; separate from live acceptance above.
- Activity state/source/emission tests: 14 passed.
- `npm run test:chat-stream-lifecycle`: seven passed.
- `npm run test:openai-web-search-phase3`: passed.
- `node scripts/test-source-search-phrasing.js`: passed, including disabled-search routing regression.
- `node --import ./scripts/register-aliases.mjs scripts/test-http-tools-phase8.mjs`: durable-write contract checks passed; no remote write dispatched.
- `npm run build`: passed on current application changes.
- Focused ESLint for the new live script: passed. This is not a full-repository lint/full-suite claim.

One initial live-harness attempt failed before a recorded product result; the rerun and full/supplemental batches above have captured terminal results. An inline read-only Prisma preflight initially hit a module-interop TypeError; resolving the pinned runner's default export completed the preflight. Neither startup issue is counted as a product failure.

## Reproduce and artifacts

```sh
AIDE_LIVE_ACCEPTANCE=1 npm run test:chat-activity-live
# Optional subset, still real provider requests and persisted test chats:
AIDE_LIVE_ACCEPTANCE=1 AIDE_LIVE_CASE=product,search,signup npm run test:chat-activity-live
```

The script only accepts a localhost/127.0.0.1 target and refuses to run without explicit opt-in. It never automatically approves an unexpected tool name. It outputs sanitized event modes/phases/timing/counts/status codes, not raw SSE, capabilities, arguments, credentials or full answers. It does not alter agent flags or configuration.

Local ignored artifacts: `.tmp/chat-activity-live/report.json`, `report-product,search,signup.json`, and scenario screenshots. Screenshots cover only newly generated test conversations; traces/auth storage are not saved. These local artifacts are not committed evidence. The search screenshot was visually inspected; other screenshots are captured but not individually visually audited.

## Remaining acceptance gates

- Plans execution/parsing and named search-lifecycle fixes are locally verified above; exhaustive pricing completeness remains outside these assertions.
- Actual web-search-off behavior in a safely isolated live configuration; only routing regression was run here.
- Real expired/denied confirmation, wrong authenticated subject, account switch and cross-conversation capability tests beyond missing/forged capability.
- Browser disconnect before/after a real authorized WRITE with independently observed remote result and canonical persistence; existing mocked lifecycle tests are not proof of this.
- Live owner Studio/authenticated customer identity, official-only external embedding question, MCP execution, human handoff/realtime fanout and exhaustive long/short knowledge grounding.
- Full-repository suite and production cutover remain separate gates. No PR, commit or push was made.
