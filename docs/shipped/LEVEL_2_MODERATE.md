# Level 2 · Moderate — shipped archive

**Status:** Done (P1–P8). **Deferred:** M7 WhatsApp + connectors.  
**Plan (historical):** [`../claude/LEVEL_2_MODERATE_PLAN.md`](../claude/LEVEL_2_MODERATE_PLAN.md)  
**Email detail:** [`EMAIL_INBOUND_CHANNEL.md`](EMAIL_INBOUND_CHANNEL.md)  
**Trust path:** [`../ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md)

Do not treat this file as the open backlog. Next: Level 3 archive · gaps in [`../claude/COMPETITIVE_DEEP_AUDIT.md`](../claude/COMPETITIVE_DEEP_AUDIT.md).

---

## What shipped

| Phase | Feature | User feel | Key surfaces |
|---|---|---|---|
| **P1** | Resolution metrics + unanswered | Analytics: AI-resolved, handoff rate, unanswered clusters | `Message.answerState`, `Conversation.resolvedBy`, `lib/analytics/resolution.js` |
| **P2** | Customer profile · Guidance | JWT traits personalize; owner if/then guidance | identity `traits`, `Agent.guidance` |
| **P3** | Assignment · round robin · SLA | Desk routes to least-busy; overdue badges | `Workspace.deskSettings`, `firstHumanReplyAt` |
| **P4** | Copilot | Suggest reply + summarize for human agents | desk copilot routes/UI |
| **P5** | Versioning | History, restore, studio draft | `AgentRevision` |
| **P6** | Targeted proactive | URL-matched proactive bubble (customization JSON) | embed proactive rules |
| **P7** | Webhooks + API keys | Signed outbound events; scoped REST keys | `WorkspaceWebhook`, `WebhookDelivery`, `ApiKey` |
| **P8** | Email channel (Resend inbound) | Email → Inbox → AI/human reply with threading | `ConversationSource.EMAIL`, `InboundEmail`, `Agent.emailChannel` |

**Deferred (not in this ship):** WhatsApp + connectors (**M7**).

---

## Migrations (additive)

Applied in Level 2 era (additive only — nullable columns, new tables, enum appends). Examples from the plan:

- `Message.answerState`, `Conversation.resolvedBy`
- `Agent.guidance` (Json)
- `Workspace.deskSettings`, `Conversation.firstHumanReplyAt`
- `AgentRevision`
- `WorkspaceWebhook`, `WebhookDelivery`, `ApiKey`
- `ConversationSource += EMAIL`, `InboundEmail`, `Agent.emailChannel`

Apply with `prisma migrate deploy` before promoting dependent code. Neon + Vercel: no auto-migrate.

---

## Deploy-safety (Level 2 rules)

1. Features **off until configured** — existing agents behave as before.
2. Additive migrations only; migrate before code that depends.
3. New routes / additive API fields only.
4. Frozen caps unchanged; profile / guidance / email / webhooks never grant authority (`DATA != AUTHORITY`).
5. Background work via request + `after()` — no cron/worker required.

---

## Related

- [`LEVEL_1_BASIC.md`](LEVEL_1_BASIC.md) — answer reliability underneath  
- [`LEVEL_3_ADVANCED.md`](LEVEL_3_ADVANCED.md) — advanced retrieve / QA / procedures  
- [`EMAIL_INBOUND_CHANNEL.md`](EMAIL_INBOUND_CHANNEL.md) — P8 detail  

*Archived: 2026-10-05.*
