# Level 1 (Basic) fixes: reliable answers before new features

## Context

Live testing (Help Center Assistant, AIDE Support Assistant, and the real-world edge-case plan) showed basic failures that customers notice first:
- the wrong tool, or no tool, gets picked
- false "UNKNOWN" answers
- "today's news" questions hand off to a human
- multi-part questions lose their answers
- replies in English to Roman Urdu
- a handoff message that implies someone is available
- no setup warnings
- a generic widget error message

**Goal:** fix each one at its root cause, with tests for every edge case, without weakening the frozen trust path (policy, confirmation, SSRF, fencing) and without breaking the existing suites.

**Proven root causes (reproduced with real data):**

| # | Symptom | Root cause (file) |
|---|---|---|
| B1 | "list all of them" → wrong tool; "repositores" → 0 tools | Sticky source applies only when the current message has an inventory word (`turn-context.js` ~l.264 `sticky === "github" && (inventoryAsk \|\| writeFollowUp)`). The GitHub regex needs `repositor(y\|ies)` exactly (`source-policy.js` l.81, `intent-clarify.js` `detectSourceAskSignals`). The shortlist uses current-message words only (`tool-shortlist.js`). |
| B2 | "order #A12345" → campaign tool → "status UNKNOWN" | The campaign tool has no entity tag, so the existing entity filter (`filterCapabilitiesForSourceRoute`, `source-policy.js` l.343) can't drop it (`inferCapabilityEntities` in `lib/capabilities/descriptor.js`). A 200 body `{status:"UNKNOWN", name:null}` counts as success (`http-executor.js` l.629; `NO_RESULT` only covers empty bodies). |
| B3 | "latest news about OpenAI today" / weather → handoff | `detectSourceSignals` web regex only matches "today's news" / "current news" (`source-policy.js` l.32–38). "current price of bitcoin" → STORE via `price`. |
| B4 | plans + password + weather → whole reply replaced by the handoff ack | The model batches `request_handoff` with other tools; the handoff runs immediately and the turn stops with `escalate` (`orchestrator/loop.js`). |
| B5 | Roman Urdu → English | `replyLanguage = detectKnowledgeLanguage(knowledgeDocs)` (`turn-context.js` l.392). The platform rule says "do not switch languages" (`prompt-builder.js` `RESPONSE_RULES_LANGUAGE_*`). |
| B6 | "Please wait while someone joins", even when nobody is there | Fixed `DESK_HANDOFF_ACK_MESSAGE` (`lib/desk/conversation-desk.js`); no business hours. Presence is Socket.IO only, which doesn't run on Vercel. |
| B7 | 0 knowledge docs, 45 tools, 19 write tools, localhost URLs: no warning | The readiness checklist (`lib/embed/readiness.js` `evaluateEmbedReadiness`) has no setup checks. |
| B8 | Expired or wrong access → "Unable to process chat" | `safeChatStreamError` (`lib/chat/server-stream.js`) doesn't know `PUBLIC_CONVERSATION_ACCESS_REQUIRED` / `CONVERSATION_OWNERSHIP_CHANGED`. The widget only special-cases identity errors (`PublicWebchat.jsx` ~l.746). |
| B9 | Redis off on live; realtime not on Vercel | Config only. |

## Prerequisite (decided)

**You commit your in-progress work first:**
- Learn-more links (`source-policy.js`, `turn-context.js`, `chat.service.js`)
- `PublicWebchat.jsx`
- `AgentTestStudio.jsx`
- crawler
- customer docs

I start only when `git status` shows none of those files modified. If any are still modified, I stop and ask. Level 1 lands in separate commits on top.

**B6 scope (decided):** business hours + an offline message only. No email capture and no new visitor data.

## Order of work

**B1, B2, B3, B4 (answer correctness) → B5 → B8 → B6 → B7 → B9 docs.** Each step gets its own commit with tests, and the frozen-path changes (routing, loop) each get a line in the `docs/ARCHITECTURE_FREEZE_STAGE6.md` change log.

### B1: tool selection survives typos and follow-ups
- **New pure module `lib/services/ai/intent-normalize.js`:**
  - `normalizeIntentTypos(text)` maps near-misses of a small vocabulary (`repository`, `repositories`, `repo`, `github`, `commits`, `issues`, `pull request`) to the canonical word.
  - It reuses `editDistance` from `knowledge-retrieve.js`.
  - Rules: same first letter, token length ≥ 5, distance ≤ 1 (≤ 2 for tokens of length ≥ 9).
  - `isFollowUpReference(text)` matches `them`, `those`, `all of them`, `the rest`, `more`, `next batch`, `show all`, `same`, `and …?` on messages of 8 words or fewer.
- **Apply `normalizeIntentTypos` before matching** in `detectSourceSignals`, `detectSourceAskSignals` and `contentTokens` (shortlist). The original text still goes to the model.
- **Sticky rule in `turn-context.js`:** `sticky === "github" && (inventoryAsk || writeFollowUp || isFollowUpReference(msg))`. Same for sticky web.
- **Shortlist context:** when sticky applies, `shortlistToolsForTurn` scores on the current message plus the last user message that set the source (`carryTokens` option). GitHub core tools are always included when `wantsGithub`, as today.
- **Edge cases, each with a unit test:**
  - "report", "comment", "repost", "tissue" and "github.io" are not rewritten
  - an explicit web ask plus a sticky GitHub turn still goes to web
  - "them" with no sticky source changes nothing
  - a capability ask ("do you have github access") still offers no live tools
  - a source-clarify reply still wins
  - Urdu script is untouched
  - empty or whitespace input

### B2: no wrong-subject tools, and "not found" isn't "success"
- **Entities:** add `CAMPAIGN` to `inferCapabilityEntities` and to `detectSourceSignals`. Also add `campaign` to `strongStoreFact`, so campaign asks route STORE and keep their tool. The existing entity filter then drops campaign tools on order questions and order tools on campaign questions.
- **Not-found sentinel:** a new pure `isNotFoundBody(json)` in `lib/actions/tool-errors.js`. It matches an object whose `status`/`state` is `UNKNOWN`/`NOT_FOUND`/`not_found`/`missing` and whose identifying fields (name/title/id besides the echoed key) are null or empty, or `{found:false}`, or `{exists:false}`.
  - The HTTP executor sets `normalizedStatus = "NO_RESULT"` (still `ok`).
  - `formatToolResultForModel` adds `noResult:true` and the hint: "No record matches this id — say it wasn't found; do not report a status."
- **Demo endpoint:** `app/api/demo/campaigns/[id]` returns 404 for unknown ids.
- **Edge cases:**
  - campaign plus order in one question keeps both tools
  - tools with no entity are unaffected
  - `status:"UNKNOWN"` with a real name is not treated as not-found
  - array bodies, non-JSON bodies, and error bodies are unchanged (the R10 test still passes)
  - GitHub MCP is unaffected (its tools have no entities)

### B3: freshness questions go to web
- **In `detectSourceSignals`, add a `freshAsk` web signal**, used only when there is no store subject:
  - `latest|recent|breaking` + `news|headlines|updates`
  - `news` with `today|this week|yesterday`
  - `weather`
  - `score|who won|match result` with a time word
  - market terms: `bitcoin|btc|ethereum|crypto|stock price|share price|exchange rate|dollar rate|gold price`
- The market terms mark the question as an external subject, so "current price of bitcoin" goes WEB, not STORE.
- Freshness plus a store subject makes it MIXED (multi-part asks).
- **Must hold (existing asserts):**
  - R01 "Ap ke latest plans kya hain?" → STORE ("latest" without news)
  - R04 → GENERAL
  - R42 → STORE
  - R47 → no web
  - R48 → MIXED
  - A5 "AI support news" → WEB
  - web search disabled → no web tool, and an honest "can't look up live info"
- **Edge case:** "latest version of your app" / "latest invoice" stay STORE.

### B4: answer first, hand off second
- **In `orchestrator/loop.js`:** when a tool batch contains `request_handoff` **and** other tool calls, **and** the last user message doesn't `matchHumanRequest` (`lib/desk/conversation-desk.js`):
  - don't dispatch the handoff
  - give the model a synthetic result: `{ok:false, status:"deferred", message:"Answer what you can from the other results first, then offer human help."}`
  - set `offerHuman`, which makes `chat.service` return `showHandoffButton: true`
- **Unchanged:**
  - a handoff on its own, or an explicit human request → handoff as today
  - the `[[NEED_HUMAN]]` marker path
  - the saved-ack reuse
- **Edge cases:**
  - the deferred handoff never mutates desk state
  - a second handoff request in the next step (alone) proceeds
  - `aiPaused` is unaffected
  - step and deadline caps are unchanged
  - public and studio behave the same
- Freeze change-log entry.

### B5: reply in the customer's language
- **New `detectMessageLanguage(text)`** (in `turn-context.js`, next to `detectTextLanguage`):
  - Arabic script → `urdu`
  - Roman Urdu with a lower threshold suited to short messages (≥ 2 lexicon hits and ≥ 20% of words, at least 3 words)
  - an explicit request ("reply in English", "Roman Urdu mein", "Urdu mein") wins
  - otherwise `null`
- **Choice order:** explicit request → current message → last detected customer language in history → knowledge language (today's rule).
- **Rule text in `buildResponseRules`:** "Reply in {lang} (the customer's language). Keep product names, UI labels and ids exactly as written. The business instructions above may set a fixed language."
- **Edge cases:**
  - "ok", "thanks", emoji and 1–2-word messages keep the previous language
  - English with a single "please"/"ji" stays English
  - mixed messages → majority
  - A4 multilingual and R41 routing are unchanged (routing doesn't read language)
- `test-f09*` pass `replyLanguage` explicitly, so they're unaffected.

### B8: clear widget errors
- **`safeChatStreamError`:** add
  - `PUBLIC_CONVERSATION_ACCESS_REQUIRED` → "This chat can't be continued here. Start a new chat."
  - `CONVERSATION_OWNERSHIP_CHANGED` → "This conversation changed. Send your message again."
  - `AGENT_UNAVAILABLE`
- **`PublicWebchat.jsx`:** on `PUBLIC_CONVERSATION_ACCESS_REQUIRED`, drop that conversation's stored token and id from `localStorage` and open a new chat, keeping the typed text as a draft.
- **Edge cases:**
  - still 401, with no detail leak
  - studio unaffected
  - the other tabs' conversations are untouched
  - identity-expired handling is unchanged

### B6: honest handoff with business hours
- **Settings:** `customization.support = { hoursEnabled:false, timezone:"UTC", weekly:[{day, open:"09:00", close:"18:00"}], offlineMessage:"" }` (JSON, no migration), with a zod schema in `lib/validations/customization.js` and defaults in `lib/customization/defaults.js`.
- **New pure `isWithinSupportHours(support, now)`** using `Intl.DateTimeFormat` with the timezone. Handles overnight ranges, closed days, invalid timezone → treat as open (fail-safe), and DST.
- **`triggerHandoff`:** outside hours, the ack is the offline message (default: "Our team is offline right now (hours: …). Your message is saved and a teammate will reply here when we're back."). The desk flow is unchanged.
- **UI:** a "Support hours" section in `FeaturesForm.jsx`.
- **Edge cases:**
  - hours off → today's ack exactly
  - an empty custom message → default
  - studio test chat uses the same logic
  - CSAT and aiPaused are unchanged

### B7: setup warnings in the readiness checklist
- **New pure `evaluateAgentSetup(input)`** in `lib/embed/readiness.js`, returning `setup[]` items (warn/fail, each with a fix hint):
  - 0 knowledge docs and no READ tools
  - owner prompt ≥ 3,600 of 4,000 chars
  - > 12 enabled MCP tools on one server
  - WRITE/DESTRUCTIVE MCP tools enabled on an embed-enabled agent
  - an HTTP action URL on localhost/127.0.0.1/private host while `NODE_ENV=production`
  - an MCP server whose credential failed
- **Inputs:** counts loaded in `embed-readiness.service.js` (one grouped query).
- **Behavior:** these are advice only; they don't change `ready` (so `test-embed-readiness.mjs` expectations hold). Rendered as an "Agent setup" group in `EmbedReadinessChecklist.jsx`.

### B9: production configuration (docs only)
- `docs/deploy/` notes for Vercel:
  - set `REDIS_URL` + `REDIS_ENABLED=1` (e.g. Upstash) for global rate limits
  - realtime (Socket.IO) needs an always-on host (Render); on Vercel the widget works without live desk updates
  - keep region `sin1`

## Verification

- **New unit tests (plain `node --test`, pure modules):**
  - `test-intent-normalize.mjs`: typos, false positives, follow-ups
  - `test-source-freshness.mjs`: every route example above, including R01, R04, R41, R42, R47, R48
  - `test-not-found-body.mjs`
  - `test-reply-language.mjs`
  - `test-support-hours.mjs`: timezones, overnight, invalid timezone, DST
  - `test-agent-setup-checks.mjs`
  - a loop test for the deferred handoff, extending the orchestrator o31 fixtures
- **Regression suites** (must match today's results; the known pre-existing failures stay listed separately):
  - `test:routing-a5-50`, `test:mandatory-a13-72`, `test:real-world-gate3`, `test:gate4-matrix`
  - `test:knowledge-a4-100`, `test:industry-a11-40`, `test:heldout-a14`
  - `test:tool-shortlist`, `test:mcp-risk`, `test:f11`, `test:f13`, `test:f14e`
  - `test:embed-readiness`, `test:embed-public-read`, `test:chat-stream-lifecycle`
  - `test:orchestrator-o31`, `test:billing-conversations`, `test:realtime-public-access`
  - `npm run lint`
- **Live re-run** of the same edge-case set used in the audit (local + Vercel sin1):
  - R11 → "not found"
  - R48 → answers plans + password + weather, with the handoff offered
  - FRESH → web
  - the GitHub typo and follow-up transcript from your screenshots → `search_repositories` every time
  - Roman Urdu → Roman Urdu reply
  - wrong token → the "start a new chat" message
  - handoff outside hours → the offline message
- **Speed check:** `npm run bench:chat-latency`, so no latency regression.
