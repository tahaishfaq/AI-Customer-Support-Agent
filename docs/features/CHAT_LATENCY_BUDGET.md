# Chat latency budget

Targets per reply type, the measured state, and how to measure. Timing only; no trust-path change.

## Targets

People notice waits past ~1 s and give up past ~10 s. Status always shows first; the answer streams.

| Reply type | First sign of life | First answer token p50 / p95 | Full reply |
|---|---|---|---|
| Replay, AI paused, handoff ack | — | ≤ 0.3 s / 0.6 s | same |
| Greeting / simple | ≤ 0.3 s | ≤ 0.8 s / 1.5 s | ≤ 2 s |
| Knowledge answer | ≤ 0.3 s | ≤ 1.2 s / 2 s | ≤ 4 s |
| One READ tool | ≤ 0.3 s, tool chip ≤ 1 s | ≤ 2.5 s / 4 s | ≤ 5 s |
| WRITE needing approval | ≤ 0.3 s | approval card ≤ 2 s / 3.5 s | — |
| Web search | "Searching the web" ≤ 1 s | ≤ 4 s / 7 s | ≤ 8 s |
| Large list | first chunk ≤ 3 s | — | ≤ 18 s (cap) |

## Where the time goes

Setup before the model is a chain of Postgres round trips, so it scales with the distance to Neon
(`ap-southeast-1`): ~100 ms per trip from a dev machine, a few ms from Render Singapore. A new TLS
connection costs ~1 s from a dev machine, so the always-on server keeps a warm pool
(`PG_POOL_MAX=10`, `PG_POOL_IDLE_MS=300000` in `render.yaml`).

Setup rules (`lib/services/chat.service.js`):

- Independent reads run together: agent ∥ conversation; prior public access ∥ token check;
  replay check ∥ quota ∥ confirmation expiry; the turn context (history, knowledge, actions) is
  built while the user message is saved (`pendingUserMessage` in `lib/services/ai/turn-context.js`).
  Every check still runs, and outcomes apply in the original order.
- No repeated reads: the studio conversation check reuses `getAgentForUser`; capabilities reuse the
  loaded agent and fetch published revisions in the same round; a new conversation skips the
  prior-access lookup.
- Quota: only a visitor's 2nd message can make a conversation billable, so other messages skip the
  owner-wide count (`assertConversationQuota`).
- Handoff: after a successful `request_handoff` the loop replies with the saved ack instead of
  another model call (`lib/orchestrator/loop.js`).
- After the reply: `done` is sent before turn-run bookkeeping; labels are written only when this
  request produced them (a deferred classify no longer resets them to GENERAL/NEUTRAL).

## Measured (dev machine → Neon, Help Center Assistant, studio, warm pool)

| | Before | After |
|---|---|---|
| Setup until `meta` | 2.35–2.45 s | 1.65–1.85 s |
| Turn context on the critical path | 0.5–0.6 s | 0 (overlapped; itself 0.32 s) |
| First token, greeting / knowledge / general | 3.8 / 3.7 / 3.8 s | 2.4 / 2.4 / 2.4 s |
| Model end → `done` | 0.7–0.9 s | 0.5 s |
| Greeting fully done | 4.7 s | 3.0 s |

Production in the database region is expected to remove most of the remaining setup (~17 trips).
Measure there before trusting that estimate.

## Measure

- Studio `done` carries `timings` (ms since request start per step, plus `context` sub-steps).
  Public embed replies never include it.
- `npm run bench:chat-latency` streams each reply type N times and prints p50/p95 against the
  targets (`BENCH_EMAIL`/`BENCH_PASSWORD` of a billed account, optional `BENCH_AGENT_ID`,
  `TEST_BASE_URL` for Render). Report: `.tmp/chat-latency-bench.json`.
- Server logs `CHAT_SLOW` with the spans for any turn over 4 s.
