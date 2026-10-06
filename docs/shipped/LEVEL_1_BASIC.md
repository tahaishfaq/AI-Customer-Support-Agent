# Level 1 · Basic — shipped archive

**Status:** Done (B1–B9).  
**Plan (historical):** [`../claude/LEVEL_1_BASIC_PLAN.md`](../claude/LEVEL_1_BASIC_PLAN.md)  
**Trust path:** [`../ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md)

Do not treat this file as the open backlog. Next work: Level 2 archive → Level 3 → [`../claude/COMPETITIVE_DEEP_AUDIT.md`](../claude/COMPETITIVE_DEEP_AUDIT.md).

---

## What shipped

| # | Fix | User feel | Key surfaces |
|---|---|---|---|
| **B1** | Tool selection survives typos + follow-ups | "repositores" / "list all of them" still hits the right GitHub tools | `intent-normalize.js`, sticky source in `turn-context.js`, `tool-shortlist.js` |
| **B2** | Wrong-subject tools + not-found ≠ success | Order asks don’t pull campaign tools; `status:UNKNOWN` → honest “not found” | `inferCapabilityEntities`, `isNotFoundBody`, HTTP executor `NO_RESULT` |
| **B3** | Freshness → web | “latest news / weather / today’s price” routes WEB when no store subject | `detectSourceSignals` `freshAsk` |
| **B4** | Multi-part + handoff | Handoff deferred so other tools can finish; reply isn’t only the ack | orchestrator loop deferred escalate |
| **B5** | Reply language | Roman Urdu (and other) follows the user, not the KB language | `replyLanguage` / prompt language rules |
| **B6** | Honest handoff offline | Outside hours / no agent → offline message, not “someone is joining” | support hours + `DESK_HANDOFF_ACK` variants |
| **B7** | Setup warnings | Embed readiness shows knowledge/tools/localhost/MCP advice (doesn’t block ready) | `evaluateAgentSetup`, Embed checklist |
| **B8** | Clear access errors | Expired / wrong access → “start a new chat”, not generic failure | `safeChatStreamError`, PublicWebchat |
| **B9** | Prod config notes | Redis + always-on realtime documented for Vercel vs Render | deploy docs |

---

## Tests (representative)

```bash
# Intent / routing / not-found / language / hours / setup
# (exact script names from Level 1 plan era — also covered by routing + orchestrator suites)
npm run test:tool-shortlist
npm run test:routing-a5-50
npm run test:orchestrator-o31
npm run test:embed-readiness
npm run lint
```

---

## Deploy-safety

1. No trust-path weaken (policy, confirmation, SSRF, fence).
2. Freeze change-log for routing / loop prompt changes.
3. Regression suites must stay green vs baseline known failures.

*Archived: 2026-10-05.*
