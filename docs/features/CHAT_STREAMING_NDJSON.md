# Chat streaming — NDJSON contract

**Status:** Shipped 2026-09-24 · **Scope:** transport + display only. The trust path in [`ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md) is unchanged.

## Transport

- `POST /api/agents/[id]/chat` (studio) and `POST /api/public/agents/[publicKey]/chat` (embed).
- Request: JSON body with `stream: true` and header `Accept: application/x-ndjson`.
- Response: `Content-Type: application/x-ndjson`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`. One JSON object per `\n`-terminated line.
- Any other `Accept` (or `STREAMING_CHAT=0`) returns the plain JSON result. An older cached embed bundle sending `text/event-stream` degrades to JSON.
- No reconnect and no automatic retry: a new message is a new POST, and history comes from the conversation GET.

## Events (in order)

```text
{"type":"start","turnId":"<clientMessageId|null>"}
{"type":"status","phase":"flush","pad":"<2 KB of spaces>"}                              // anti-proxy-buffering; clients ignore
{"type":"status","status":"processing","phase":"thinking","message":"Thinking…"}
{"type":"meta","conversationId":"…","userMessageId":"…","realtimeAccessToken":"…"}   // embed-only token
{"type":"activity","data":{ agent_activity row }}
{"type":"status","phase":"understanding|searching|answering", …}                       // never regresses
{"type":"text","delta":"…"}                                                            // real model tokens only
{"type":"text","delta":"<full text>","replace":true}
{"type":"cards","data":{"citations":[],"sources":[],"usedKnowledge":[]}}
{"type":"actions","data":{"pendingConfirmations":[],"showHandoffButton":false,"handoffTriggered":false,"identityRefreshRequired":false}}
{"type":"complete"}
{"type":"done","body":{"success":true,"data":<turn result>}}
{"type":"error","code":"…","message":"…","status":500}
```

Phases: `thinking` (turn prep) → `understanding` (knowledge) → `searching` (HTTP/MCP/web/handoff tool) → `answering` (first non-empty text). A `replace` with `""` (draft cleared before tools) lets `searching` fire again.

## `list` (large tool results)

`{"type":"list","data":{"listId","title","items":[{title,description,url,language,stars,state,visibility,updated}],"total","done"}}` — chunks of a large READ list (e.g. GitHub repositories), appended client-side by `listId` into a list card under the reply. When the visitor asks for "all", the gateway pages sequentially (100 per page, max 5 pages / 500 items / 18 s); the model receives a compact summary text (≤3,600 chars) and is told to summarize, not re-type rows. Items are untrusted data: plain text, https links only. After `done` the card renders from `toolSteps[].list`. Code: `lib/mcp/list-result.js`.

## `replace`

Streamed text is overwritten, not appended, when:

- the model streamed a draft and then chose tools (`replace` with `""`);
- the server authors the text: GitHub refusal, stream-failure fallback, or tool-step synthesis;
- the final persisted `message.content` differs from what streamed (e.g. clarify).

Finished text is never chunked on a timer. A final text that differs only in whitespace is not replaced.

## UI

One assistant bubble per turn (`MessageList` → `MessageBubble`): it shows the latest `status.message` until the first token, then fills in place. The same markdown renderer is used while streaming (`lib/chat/stream-markdown.js` closes unfinished `**`, backticks, fences and links), so nothing re-renders on `done`. Tool pills (HTTP/MCP/web/handoff) sit above the bubble with plain-language labels; prep and knowledge are shown only on the status line.

## Duplicate sends

If a second request carries a `clientMessageId` whose `TurnRun` is still live (active status, heartbeat < 90 s, different `requestId`), it gets `409 TURN_IN_PROGRESS`. The client recovers from the conversation snapshot and does not re-POST.

## Code

| Concern | Path |
| --- | --- |
| Line format / parse | `lib/chat/ndjson.js` |
| Server stream + wire mapping | `lib/chat/server-stream.js` (`createWireEventMapper`) |
| Client reader | `lib/chat/read-chat-response.js` |
| Client hook (pending bubble, status, Stop) | `hooks/use-chat-stream.js` |
| Turn claim | `lib/services/turn-run-state.js` |
| Tests | `npm run test:chat-stream-lifecycle` |
