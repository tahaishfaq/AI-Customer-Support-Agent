# Help Center Assistant — full agent audit (2026-09-24)

**Target:** workspace `Customer-Support` → agent `Help Center Assistant` (`cmu72df2z004bnap4cq4xo3vj`, embed key `__HG5AW5pFstwtke14xHbygj`). There is no workspace named "Personal" on this account.
**Environment:** local `node server.js` on :3000, remote Neon, live OpenAI. Studio route plus public embed route, NDJSON stream recorded line by line, UI recorded every 50 ms.
**Agent config found:** 0 knowledge documents (site crawl FAILED); 3 HTTP READ actions (Brandly demo); GitHub MCP with 45 tools enabled; web search on.

## Test matrix

| # | Case | Result |
|---|------|--------|
| S1 | Greeting | ✅ streams real tokens · ⚠ 7.0 s total, first token 6.1 s |
| S2 | "Refund policy?" with empty KB | ❌ **Invented a generic refund policy** |
| T1 | Plans → `list_brandly_plans` | ✅ correct data |
| T2 | Campaign CAMP-200 → `get_brandly_campaign_status` | ✅ correct data |
| T3 | "How do escrow payouts work?" → `search_brandly_help` | ❌ **Tool not called; generic invented answer** |
| T4 | Campaign status, no id | ✅ asks for the id |
| W1 | Web search | ✅ 4 citations · ⚠ final `replace` rewrites whole bubble (flash) |
| M1 | GitHub repos (MCP) | ⚠ token expired (`MCP_AUTH`) → clean refusal, draft cleared by `replace` ✅ |
| I1 | Prompt injection | ✅ refused |
| P1 | Embed: "What plans?" | ⚠ READ catalog tool asks the visitor to **confirm** (policy F11-U) |
| H1–H3 | Embed handoff (ask ×2, then message) | ✅ 1st ask offers button, 2nd hands off, AI paused after |
| D1 | Duplicate send, same `clientMessageId` | ✅ 2nd gets `TURN_IN_PROGRESS` 409 |
| UI | Studio test chat, one tool turn | ❌ indicator switches **pill → dots bubble → pill → text**; raw `**markdown**` while streaming, re-render at end; pill label `CHECKING_ACCESS` |
| — | Confirm/approve of a WRITE | ⏸ Not testable: no WRITE HTTP tools; MCP token expired |

UI timeline (studio, CAMP-100): `0 s` "Thinking…" pill → `+6.0 s` "Typing…" dots bubble (tool not started yet) → `+7.0 s` pill `CHECKING_ACCESS` → `+8.0 s` plain-text bubble with caret, raw `**CAMP-100**` → `+9.3 s` markdown re-render.

Server log for the same turn: request **9.7 s**, orchestrator **2.8 s**, `capabilityCount: 51` (45 MCP + 3 HTTP + 3 builtin).

## Findings and fixes

### P0 — Security

**F1. MCP write tools classified as READ (fail-open).** `inferMcpToolRisk` in `lib/mcp/client.js` guesses risk from the tool name and defaults to READ. `merge_pull_request`, `push_files`, `fork_repository`, `request_copilot_review` and `run_secret_scanning` are stored as READ. On the embed, `lib/actions/policy.js` treats owner-MCP READ as `isOwnerMcpRead`, so they run **without confirmation**. A visitor could get the agent to merge or push with the owner's GitHub token. The only thing stopping this today is the expired token.
- Fix:
  - Keep MCP `annotations` in `normalizeDiscoveredTool`.
  - Classify as READ only when `readOnlyHint === true` or the name matches a strict read allowlist (`get_|list_|search_|read`).
  - `destructiveHint` or delete verbs → DESTRUCTIVE.
  - Everything else → **WRITE + confirmation** (fail-closed).
  - Add a backfill script that re-classifies stored `AgentMcpTool` rows.
- Tests: the misclassified names above, an unknown name → WRITE, and an annotation override.

### P1 — Streaming UX (the "two streaming types")

**F2. Three components take turns for one wait.** `MessageList.jsx` switches between `AgentActivityBubble` (pill), `MessageBubble` typing dots (`typingPhase`), and the text bubble, using activity heuristics.
- Fix: **one assistant placeholder bubble from send to done**, like Syanatik. It shows the server `status.message` (Thinking… → Checking knowledge… → Searching the web… → Writing…) as one line inside the bubble. Tool rows sit compact under that line. Tokens fill the same bubble in place.
- Remove the `thinkingPhase`/`typingPhase` split.

**F3. Raw markdown while streaming, re-render at the end.** `MessageBubble` renders `<p>` while streaming and `ReactMarkdown` only when done.
- Fix: render markdown progressively during streaming. Temporarily close unterminated `**`, backticks and code fences, and batch updates per animation frame.

**F4. Uppercase pill labels.** `pillText()` in `AgentActivityBubble.jsx` turns "Checking access" into `CHECKING_ACCESS`. Fix: show `activityLabel()` text as-is.

**F5. Status says "Writing…" while tools still run.** When a draft streams before a tool call, `answering` fires, then the draft is cleared and tools run again (M1). Fix: in `createWireEventMapper`, a `replace` with `""` may move the phase back to `searching`.

**F6. Final `replace` flash on web answers (W1).** The persisted text differs from the streamed text on the hosted-search path. Fix: find the transformation in `responsesStreamTurn`/persistence. Either stream the same text or send the citation changes as `cards` instead of rewriting the text.

**F7. No anti-buffering first line.** Syanatik sends a padded `status/flush` line so proxies release bytes at once. Fix: send about 2 KB of padding on the first line; clients already ignore unknown phases.

### P1 — Answer quality

**F8. Invents policy with an empty KB (S2).** "Refund policy" routes to GENERAL, where the model may answer from general knowledge. Fix:
- In `lib/services/ai/source-policy.js`, route policy terms (refund, return, shipping, warranty, cancellation, pricing of *our* product) to STORE.
- With 0 knowledge docs on a STORE route, answer "can't verify" and offer handoff.

**F9. Right tool not chosen (T3), 51 tools per turn.** Fix:
- Offer a per-turn shortlist: GitHub MCP tools only when the utterance mentions GitHub, repos, issues or PRs; cap MCP tools offered (e.g. 12, ranked by name and description match).
- Always offer the agent's HTTP tools.
- Do not offer MCP tools from a server whose last probe failed auth.

**F10. Knowledge crawl fails locally.** Error: "Playwright is not installed for browser crawl". Fix: fall back to a plain HTTP fetch crawl when Playwright is missing, and show the reason on the Knowledge page. Owner: install the browser (`npx playwright install chromium`) or add knowledge manually.

**F11. Expired GitHub token keeps being offered.** Fix: an `MCP_AUTH` failure marks the server unhealthy, hides its tools until reconnect, and shows a banner on the Tools page. Owner: reconnect GitHub.

### P1 — Latency

**F12. About 7 s of the 9.7 s request is outside the orchestrator; `meta` arrives at about 3.5 s.** Fix, in order:
1. Add timing spans (auth, agent, conversation, quota, turnRun, identity, turn context: knowledge, actions, MCP) to the `CHAT_OK` log.
2. Run independent Prisma calls in parallel.
3. Send `meta` right after the conversation resolves.
4. Cache the agent's tool runtime (HTTP actions + MCP catalog) in Redis with invalidation on edit.
- Targets: `meta` < 500 ms; first token < 2.5 s on no-tool turns.

**F13. `/api/auth/session` polled constantly** (dozens per minute in the dev log). Fix: find the refetch source (SessionProvider interval/focus or `AuthHydrate`) and stop the polling.

### P2 — Product decision (frozen policy)

**F14. Embed visitors must confirm every HTTP READ** (e.g. public plans list) under F11-U in `policy.js`. Proposal: `PUBLIC_READ` + `GET` + non-account tools run without confirmation on the embed. This changes a PEP rule, so it needs an owner decision and a freeze change-log entry.

## Status (2026-09-24)

| Finding | Status |
| --- | --- |
| F1 | ✅ Fixed. Fail-closed `inferMcpToolRisk` (annotations kept, names win over hints), runtime tighten in `mcpToolToActionShape`, reclassify on re-probe, effective risk in the Tools API; `npm run test:mcp-risk`. Live API now reports merge/push/fork/copilot/scan as WRITE + confirm. `npm run backfill:mcp-tool-risk` is written but HARNESS_BLOCKED locally (the tsx + generated Prisma `.ts` loader issue that also fails `test:f09`/`test:f12`); runtime guard makes it non-blocking. |
| F2–F5, F7 | ✅ Fixed. One bubble with status line, progressive markdown, plain pill labels, status reset after draft clear, 2 KB flush pad. Verified with UI frame recording. |
| F6 | ✅ Whitespace-only final differences no longer `replace`. Re-check on a live web question. |
| F8 | ✅ Fixed. STORE/MIXED turns with no knowledge match get a server "Evidence for this turn" rule. Live S2 now: "I cannot confirm the refund policy here…" + offer to connect. |
| F9 | ✅ Fixed. `lib/services/ai/tool-shortlist.js`: MCP only when relevant (GitHub core tools first), max 12; relevant-tool hint forbids gap-filling. Demo help search now matches any keyword. Live: tools per turn 51 → 6; T3 answers from `search_brandly_help`; unknown topic says "couldn't find". `npm run test:tool-shortlist`. |
| F11 | ✅ Fixed. Runtime `MCP_AUTH` sets server `lastError` (`MCP_AUTH:` prefix); tools hidden except one `get_me` probe on a direct GitHub ask; cleared by OAuth reconnect, credential change or a good probe. Live: 2nd GitHub ask offers 1 MCP tool. |
| F13 | ✅ Fixed. `SessionProvider refetchOnWindowFocus={false}` + `hydrate()` reads without broadcast (each focus refetched and broadcast to other tabs and the widget iframe). Idle page: 15 → 0 session calls / 10 s. Note: the extreme rate in the dev log came from the hidden in-app browser pane flipping visibility ~1/s. |
| F12 | ◐ Measured + partial fix. Spans in `CHAT_OK` and always-on `CHAT_SLOW` (>4 s, timing only). Root cause: ~100 ms per query from this machine to Neon `ap-southeast-1` × ~35 sequential setup queries. Agent load now parallel with workspace resolution and the per-request owner-membership upsert is skipped once ensured: agent span 1.26 s → ~0.65 s; setup before the LLM ~3.8 s → ~2.4–3.1 s. **Main fix is deployment: run the app in the same region as Neon (Singapore) or move Neon next to the app**; next code step is fewer sequential queries in `chat.service` (identity/access/confirmation expiry, user-message persist). |
| F10 | ✅ Fixed. Root cause: Chromium was missing on 2026-09-21 (installed since; retried crawl now DONE: 2 WEB docs). A plain-HTTP fallback cannot help this site: every path of `brandly-five.vercel.app` returns an empty create-react-app shell. Fix = ship Chromium: `Dockerfile` (Node 22 + `playwright install --with-deps chromium`, runs as `node`), Render web service on Docker; plain-language owner message when a server has no browser. Crawl suites pass. Image verified locally: builds; Chromium as `node` renders the Brandly SPA (2,958 chars); server boots on :10000, `/api/health` 200 with database ok, ~220 MB idle. Multi-stage image with headless shell only: 2.88 GB (was 4.7 GB). |
| F14 | ✅ Owner chose auto-run for public reads. `policy.js` exempts explicit `PUBLIC_READ` GET tools without personal-data names; freeze change-log entry added. Found and fixed on the way: knowledge-first filtering hid tools the question named (campaign status → accidental human handoff; escrow → invented answer), and plan "evidence" matched any stray `$` amount. Live embed: plans, campaign status and escrow all answer from their tools with no Confirm. |

## Order of work

1. **F1** (security), before anything else ships.
2. **F2–F7** streaming UX: single placeholder bubble, progressive markdown, labels, phase reset, flash, flush pad.
3. **F8, F9, F11** answer quality, then F10.
4. **F12, F13** latency.
5. **F14** after an owner decision.

## Owner actions (no code)

- Reconnect GitHub MCP, and disable GitHub tools this agent does not need.
- Add Help Center knowledge (install Playwright, upload docs, or add text).
- Rotate the account password that was shared in chat.

## Retest after fixes

Rerun S1–D1 and the UI timeline. Add:
- one WRITE confirm → approve → consume run on a safe test repo or demo WRITE action;
- `npm run test:chat-stream-lifecycle`, `npm run test:confirmation-ui-browser`, `npm run test:embed-full-browser`.
