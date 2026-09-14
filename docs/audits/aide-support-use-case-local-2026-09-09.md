# AIDE customer-support use-case verification

## Follow-up: explicit search phrasing fix

The screenshot wording `So can you search on internet is there an y company that provide the same customer service that we are doing` reproduced GENERAL routing with web search removed, even with the agent flag enabled. The router now recognizes `search on internet`, `search on the internet`, corresponding web variants, and repeated whitespace. Store/general restrictions and the disabled-agent flag remain enforced.

`node scripts/test-source-search-phrasing.js` failed before the change and passed afterward. Focused ESLint passed. The existing Stage 5.5 harness reported 17 passes and one unrelated wiring failure: it still expects STORE_SOURCE_REQUIRED and mayInvokeWebSearch literals in builtin.adapter.js. All its route cases passed; the legacy assertion was not weakened.

Live Chromium verification on the actual homepage embed with the exact screenshot sentence returned HTTP 200, searchUsed=true, 16 sources, selected/running/completed web_search events, 283 text delta events, and no SSE errors. The final answer listed similar customer-support providers with citations. Individual competitor claims were not independently fact-checked. This verifies search execution and streaming, not fixes to the activity UI or other issues below.

Date: 2026-09-09. Scope: local website at http://localhost:3000, its existing floating embed, and existing AIDE Support Assistant. This is targeted live verification, not full-suite or production acceptance.

## Correct agent and setup

The tested agent is `cmtto3v8y006myyp4xhtekjxh` (AIDE Support Assistant). The website's existing GlobalEmbedLoader already targets this agent. Its existing AIDE Quick FAQ and AIDE FAQ Handbook were preserved.

Three public READ tools were created and published on this agent:

| Tool | Actual local endpoint | Response projection | Owner test |
| --- | --- | --- | --- |
| get_aide_public_plans | /api/billing/plans | plans | OK, upstream 200 |
| get_aide_signup_availability | /api/public/platform | signupsEnabled | OK, upstream 200 |
| get_aide_maintenance_status | /api/public/platform | maintenanceMode | OK, upstream 200 |

These are real local HTTP requests to AIDE public routes, not HTTPS/TLS verification. No owner session or private billing credentials were added to public actions. Five distinct real business tools were not completed; only these three supported public operations were configured. Previously created Brandly demo tools were not deleted or reused.

## Browser results

Playwright Chromium loaded the actual local homepage and interacted with the existing script-injected iframe. Fresh browser contexts isolated each question. Chat responses were awaited to completion; SSE event types and sanitized outcome fields were inspected without saving conversation capabilities or credentials.

| Customer scenario | Observed result |
| --- | --- |
| What exactly is AIDE and how can it help my business? | Relevant AIDE product explanation, HTTP 200 SSE, 44 delta events, visible assistant typing. No unrelated order/campaign answer. |
| How do I add FAQs/PDFs and embed my agent? | Relevant knowledge/setup and embed instructions, HTTP 200 SSE, 37 deltas, visible typing. Exact UI-label accuracy was not exhaustively verified. |
| Check current AIDE plans and prices | Correct pricing tool selected; confirmation shown. After browser confirmation, tool returned CONTENT_TYPE_INVALID and assistant reported inability to retrieve prices. Owner test had passed, so end-to-end pricing is FAIL. Root cause not yet diagnosed. |
| Can new customers register now? | Correct signup tool selected. After browser confirmation, tool returned OK and assistant correctly said signups enabled. Before confirmation, assistant incorrectly said customers could not register; answer grounding is FAIL despite successful confirmed execution. |
| Search official Shopify instructions for embedding AIDE, rollout disabled | No web search executed; irrelevant signup tool selected. Not a provider-credit diagnosis. |
| Same AIDE/Shopify question, rollout enabled | searchUsed=true, 12 sources, selected/running/completed web_search events, 334 deltas, visible typing, no SSE error. Answer cited a third-party source despite request for official instructions; official-source compliance is not passed. No Shopify installation was performed. |

## Activity UI defects

The browser observed only `Completed checks`, not a reliable visible running HTTP/search label. SSE event delivery alone does not prove the progress UI works. MessageList currently renders activity only for a message already marked streaming, while PublicWebchat creates that message on the first text delta. This ordering explains why tool work before the first delta is not shown at the expected time.

Confirmation-required HTTP events were labelled `failed`/ERROR in activity events, despite being a user decision checkpoint. The visual activity path needs correction and a regression test.

## Runtime and limits

The local .env did not enable STREAMING_CHAT or OPENAI_WEB_SEARCH_ENABLED. For the successful search test, the local process was restarted with:

```sh
STREAMING_CHAT=1 OPENAI_WEB_SEARCH_ENABLED=true npm run dev
```

The .env file was not edited; these process overrides do not persist after an ordinary restart. The successful hosted search disproves the earlier unsupported claim that credits were necessarily blocking search.

This run does not establish authenticated customer identity, private account tools, human-agent typing, full human handoff, all five original HTTP tools, production readiness, or a full browser suite pass. No application fixes were made in this verification pass. Remaining priorities are pricing execution diagnosis, confirmation-grounded answers, visible running activity, official-source behavior, and safe customer identity integration for private AIDE tools.
