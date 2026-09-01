# F12-E / F12-D — Escalation settings + Desk gaps vs Botpress

**Status:** 📋 Planning — **awaiting approval** (no implement until you say go) · synced Aug 31, 2026  
**Parent:** [`F12_HUMAN_DESK.md`](F12_HUMAN_DESK.md) ✅ shipped · [`ARCHITECTURE_ACTIONS_AND_DESK.md`](ARCHITECTURE_ACTIONS_AND_DESK.md)  
**References:** Botpress **Escalation** settings + **Botpress Desk** operator UI (your screenshots)  
**Rule:** One phase → test → next. Desk security first (no fake HUMAN, workspace isolation).  
**O01 sync:** Handoff already exposed as builtin capability `request_handoff` via Capability Registry. Escalation **settings UI** (E-track) configures Agent-layer rules / copy — **do not** add shop-specific if/else inside `runTurn`. Desk (D-track) stays Channel/Inbox UI.

Yeh doc **do tracks** cover karti hai:

| Track | Code | Matlab |
|-------|------|--------|
| **E** Escalation | E0–E4 | Customization: kab / kaise handoff |
| **D** Desk UI | D1–D5 | Inbox operator screen jo Botpress Desk se missing hai |

---

# Part 0 — Simple summary

## Kya chahiye?

Owner ko **Customization** mein ek **Escalation** page chahiye jahan woh decide kare:

1. Escalation **on/off**  
2. **Kab** human ko dena (rules)  
3. Handoff se **pehle** kya kehna / karna (procedure / message)

Visitor ko farq nahi — woh same widget mein “human will reply” dekhta hai. Owner **Inbox** se reply karta hai (pehle se F12).

## Kya pehle se hai? (dobara mat banana)

| Pehle se (F12) | Status |
|----------------|--------|
| Talk to human / keywords | ✅ |
| Sensitive topics (AI pehle try) | ✅ (chhoti list, code defaults) |
| AI `[[NEED_HUMAN]]` | ✅ |
| Builtin `request_handoff` (O01 Capability) | ✅ |
| Status `WAITING_HUMAN`, AI pause | ✅ |
| Inbox, claim, resolve, return to AI | ✅ |
| Ack + wait-timeout messages | ✅ (fixed copy) |
| Priority, notes, CSAT | ✅ (U-track) |
| Handoff rate limits / eligibility | ✅ |

## Kya naya hai? (yeh plan)

| Naya | Matlab |
|------|--------|
| **Enable escalation** toggle | Agent-level on/off (Botpress jaisa) |
| **Rules editor** | Owner-editable: human ask, high-stakes, failed resolution, frustration |
| **Procedure before handoff** | Optional message / checklist before Desk |
| **Escalation UI** | Customization section — not only buried in Features |

---

# Part 1 — Botpress pic → Aide mapping

| Botpress UI | Aide today | Plan |
|-------------|------------|------|
| Title “Escalation” + Desk promo | `/inbox` exists | Link “Open Inbox” on Escalation page |
| Enable escalation ON | Always-ish available | `escalation.enabled` on agent customization |
| Human request | Keyword list in code | Owner can edit phrases + “1st ask = CTA, 2nd = handoff” policy |
| High-stakes topics | Tiny sensitive list | Owner list: refunds, fraud, lockout, legal… + “AI try first” vs “instant” |
| Failed resolution | Partial | Rule: N unanswered / KB-miss turns → escalate |
| Frustration signals | Sentiment stored | Rule: NEGATIVE streak / angry keywords → escalate |
| Procedure before handoff | Fixed ack string | Editable ack + optional “collect email” step (lite) |
| Refine with Vibe | N/A | **Out of scope** (no vibe AI editor MVP) |

---

# Part 2 — Exact flows

## 2.1 Visitor (no change to channel)

```
Chat OPEN
  → rule matches (ask human / stakes / fail / frustration)
  → (optional) procedure message
  → WAITING_HUMAN
  → Ack in widget
  → Owner Inbox
  → HUMAN replies same thread
```

## 2.2 Owner config

```
Customization → Escalation
  → Toggle Enable
  → Edit rule blocks (checkboxes + fields)
  → Edit “Before handoff” message
  → Save
  → Open Inbox (link)
```

## 2.3 When escalation OFF

- No auto handoff from rules  
- No Talk-to-human CTA (or CTA hidden)  
- AI continues; optional soft “we’ll email you” — product choice: **hard off** recommended  

---

# Part 3 — Data model (sketch)

Store under agent `customization.escalation` (JSON) — same pattern as `features` / `deploy` — **no new table required for MVP**.

```json
{
  "enabled": true,
  "rules": {
    "humanRequest": {
      "enabled": true,
      "phrases": ["talk to human", "speak to a person", "..."],
      "secondAskHandoff": true
    },
    "highStakes": {
      "enabled": true,
      "topics": ["chargeback", "fraud", "account lockout", "lawyer"],
      "mode": "try_ai_first"
    },
    "failedResolution": {
      "enabled": true,
      "maxFailedTurns": 3
    },
    "frustration": {
      "enabled": true,
      "negativeStreak": 2,
      "phrases": ["this is useless", "i will sue", "..."]
    }
  },
  "procedure": {
    "ackMessage": "Thanks — connecting you with a human. Please wait…",
    "preHandoffHint": "Collect relevant context and set expectations."
  }
}
```

**Defaults** = today’s code constants (`HUMAN_REQUEST_KEYWORDS`, ack message, etc.) so old agents behave same until owner edits.

Runtime: `lib/desk/conversation-desk.js` + chat handoff path **read these settings** instead of only hard-coded lists.

---

# Part 4 — Security & product rules

1. Customer **kabhi** `HUMAN` role forge nahi kar sakta (pehle se).  
2. Escalation OFF → no status flip to `WAITING_HUMAN` from public chat.  
3. High-stakes **instant** handoff optional — default **try_ai_first** (refund pehle mention pe turant Desk mat bharo).  
4. Frustration auto-escalate: false positives possible — start conservative (streak ≥ 2).  
5. Procedure text = ASSISTANT message only — tools/playbooks Botpress “/” **MVP mein nahi**.  
6. Rate limits / handoffCount / cooldown **rehne chahiye** (abuse).  
7. Admin inspect read-only; escalation config = owner agent only.

---

# Part 5 — Edge cases

| ID | Scenario | Expected |
|----|----------|----------|
| E01 | Escalation disabled + user says “human” | No handoff; AI explains / soft message |
| E02 | First “talk to human” | CTA / AI try (existing second-ask policy if on) |
| E03 | Second ask | Handoff |
| E04 | Topic “refund” once | try_ai_first → no instant Desk |
| E05 | Failed turns hit N | Handoff + reason `failed_resolution` |
| E06 | One angry message | No escalate if streak rule = 2 |
| E07 | Already WAITING_HUMAN | Idempotent; no double count abuse |
| E08 | Empty phrase list | Fall back to built-in defaults |
| E09 | Ack message empty | Use system default ack |
| E10 | Owner offline | Still queue WAITING_HUMAN + timeout copy |

---

# Part 6 — Phased delivery

## Phase E0 — Spec freeze + defaults wiring

**Build:** Document defaults = current keywords/ack; add `customization.escalation` read helper with fallbacks; **no UI yet**.

**Test:** Existing `test:f12*` still green with empty escalation JSON.

---

## Phase E1 — Enable toggle + Escalation UI shell ⭐

**Build**

- Customization section **Escalation** (or Features sub-panel — prefer own section like Botpress)  
- Toggle Enable  
- Link “Open Inbox” → `/inbox`  
- Save via existing customization save  

**Test**

- [ ] OFF → public handoff blocked  
- [ ] ON → previous behavior  
- [ ] Non-owner cannot PATCH other agent  

**Exit:** Owner can turn Desk escalation off/on.

---

## Phase E2 — Rules editor (When to escalate)

**Build**

- Four rule cards (checkboxes + fields):
  1. Human request (phrases + second-ask toggle)  
  2. High-stakes (topics + mode try_ai_first | instant)  
  3. Failed resolution (maxFailedTurns)  
  4. Frustration (negativeStreak + optional phrases)  
- Wire into handoff detection in chat/desk helpers  
- `handoffReason` codes: `human_request` | `high_stakes` | `failed_resolution` | `frustration` | `ai_marker`

**Test**

- [ ] Each rule can trigger alone  
- [ ] Disabled rule never triggers  
- [ ] try_ai_first does not instant-handoff on first topic hit  
- [ ] E01–E07 subset automated  

**Exit:** Botpress-like “When to escalate” real.

---

## Phase E3 — Procedure before handoff

**Build**

- Editable ack message (replaces fixed `DESK_HANDOFF_ACK_MESSAGE` when set)  
- Optional short “procedure hint” shown to **owner** on Inbox thread (not customer) — e.g. “Collect order id”  
- Customer still sees only ack (security: don’t dump internal checklist to visitor)

**Test**

- [ ] Custom ack appears in widget  
- [ ] Empty → default ack  
- [ ] Owner sees hint in desk UI  

---

## Phase E4 — Polish

- Sensible presets (“Support default” one-click)  
- Validate max phrase list length  
- Docs in README / F12  
- Optional: analytics count by `handoffReason`  

**Out of scope (named)**

- “Refine with Vibe” AI rule writer  
- Playbooks / `/` tool steps before handoff  
- Multi-agent routing / shifts (needs teams)  
- Phone / WhatsApp escalate  

---

# Part 7 — UI sketch (Aide, not Botpress clone)

```
Escalation
When and how this agent hands a chat to you in Inbox.

[ Open Inbox ]

Enable escalation  ( ) off  (•) on
When on, rules below can move a chat to WAITING_HUMAN.

When to escalate
  [x] Human request     [ edit phrases ]
  [x] High-stakes       [ edit topics ]  mode: try AI first ▾
  [x] Failed resolution after [ 3 ] turns
  [x] Frustration       streak [ 2 ] + phrases

Before handoff
  Message to visitor: [ ................ ]
  Note for you (Inbox only): [ ........ ]
```

Keep Aide teal / existing CustomizationStudio patterns — dark Botpress skin copy mat karo.

---

# Part 8 — Botpress Desk screenshot → Aide Inbox (full gap list)

**Aide surfaces today:** `/inbox`, `InboxShell`, `DeskThread`, handoff APIs.

## 8.1 Comparison table

| # | Botpress Desk item | Aide aaj | Gap? |
|---|--------------------|----------|------|
| L1 | Needs Reply toggle | Partial — “My Inbox” = `WAITING_HUMAN` folder | Dedicated Needs-reply toggle / filter |
| L2 | Search tickets | Yes — agent / last msg / reason | Extend: conversation id, customer subject |
| L3 | Ticket list | Yes — conversation rows | OK (Aide = conversation, not separate ticket entity) |
| L4 | **Frustrated** badge | Partial — sentiment dot NEGATIVE | Label “Frustrated” + filter by frustrated |
| L5 | Open filter | Yes — Open / Waiting / Resolved / All | OK |
| L6 | Sort: Last activity | Partial — fixed server order | Owner-facing sort control |
| C1 | Handoff banner | Yes — waiting + AI paused | OK (copy can improve) |
| C2 | Chat history | Yes | OK |
| C3 | Transfer system line | Partial — ASSISTANT ack | Distinct “Transferred to human” system style |
| C4 | **AI summary** gold card | Partial — transcript `handoffSummary` | Optional **LLM** short summary card |
| C5 | **Suggested reply** Edit/Send | **No** | AI draft for owner + Edit / Send |
| C6 | Composer | Yes | OK |
| C7 | Canned replies | Yes | OK |
| C8 | Emoji picker | **No** | Nice-to-have |
| C9 | Image / file attach (desk→user) | **No** | Attachments from human (security/size limits) |
| C10 | Reply to User label | Yes — Reply | Copy only |
| C11 | **Await** (snooze) | **No** | Snooze / remind later |
| C12 | Close | Yes — Resolve & close | OK |
| C13 | **Next** ticket | **No** | Keyboard/button next waiting |
| R1 | Status | Yes | OK |
| R2 | Assignee | Partial — Claim/Release | Full assignee only with Teams (OOS) |
| R3 | **Team** | **No** | Needs P3-TEAMS |
| R4 | Priority | Yes — NORMAL/HIGH/URGENT | Map Medium≈NORMAL in UI copy optional |
| R5 | Source (HITL) | **No** | Show handoff source / reason as Source |
| R6 | Bot name in Details | Partial — header | Put in right rail Details |
| R7 | Channel (Webchat) | **No** | Always webchat for now — show badge |
| R8 | Ticket / conversation ID | **No** in panel | Show id + copy button |
| R9 | External ID | **No** | Optional `customerSubject` / future externalKey |
| R10 | System label | **No** | Skip or “Aide Desk” |
| R11 | Created + Last activity | Partial — waiting since | Sidebar timestamps pair |
| R12 | Customer presence Away | **No** | Presence needs heartbeat (hard) — defer |
| R13 | Customer ID visible | **No** | Show `customerSubject` read-only |
| R14 | Name / Email / Phone edit | **No** | Lite CRM fields on conversation |
| R15 | Topics tags | Partial — Category chip | Free-form or richer tags later |

## 8.2 Aide ke paas jo Botpress shot mein nahi dikha (mat bhoolna)

Ye pehle se Aide strength hain — plan mein “remove” mat karna:

- Internal **notes** (INTERNAL)  
- **CSAT** after resolve  
- **Claim / Release** soft-lock  
- **Return to AI**  
- Handoff **reason** strip  
- Human **typing** → embed  
- Inbox **seen / counts / soft-cap**  
- Priority **list filters**  
- Poll refresh  

## 8.3 Priority for Desk gaps (product)

**P0 (high value, fits single-owner MVP)**

1. Suggested reply (AI draft Edit/Send) — C5  
2. Better AI summary card — C4  
3. Right rail: ID, bot, channel, source/reason, timestamps — R5–R8, R11  
4. Frustrated badge + filter — L4  
5. Next waiting conversation — C13  

**P1**

6. Needs Reply clearer filter — L1  
7. Customer subject + lite Name/Email fields — R13–R14  
8. Desk → user file/image attach — C9  
9. Sort control — L6  

**P2 / defer**

10. Await/snooze — C11  
11. Emoji picker — C8  
12. Team / multi-assignee — R2–R3 (Teams)  
13. Live presence Away — R12  
14. Free-form topics — R15  

---

# Part 9 — Desk UI phases (Track D)

## Phase D1 — Right rail Details ⭐

**Build:** Sidebar block — Status, Priority (existing), Bot name, Channel=Webchat, Conversation ID (+copy), Source=`handoffReason`, Created / Handoff at / Last activity, Customer subject read-only.

**Test:** Waiting thread shows all fields; no PII invent.

---

## Phase D2 — Frustrated + list UX

**Build:** NEGATIVE → “Frustrated” badge; filter chip; optional Needs-reply = waiting with no HUMAN reply yet.

**Test:** Badge on negative; filter works.

---

## Phase D3 — AI summary card + Suggested reply ⭐

**Build**

- LLM one-paragraph summary on handoff (fallback = today’s transcript summary)  
- “Suggested reply” box: generate from summary + last user msg  
- Buttons: Edit (into composer) / Send (as HUMAN)  
- Rate-limit generation; never auto-send without owner click  

**Security:** Suggestion is draft only; owner is accountable; don’t leak INTERNAL notes to customer unless intended.

**Test:** Generate → Edit → Send appears as HUMAN; visitor sees it; fail soft if OpenAI down.

---

## Phase D4 — Next + composer extras

**Build:** Next waiting thread; optional emoji; desk attachments (reuse chat attachment limits/SSRF).

**Test:** Next skips resolved; attach size/type enforced.

---

## Phase D5 — Customer lite CRM + Await (optional)

**Build:** Editable name/email/phone on conversation JSON; Await snooze until timestamp.

**Test:** Fields persist; snooze hides from Needs-reply until due.

**Defer if:** Teams / presence still OOS.

---

# Part 10 — File map

```
# Escalation track
components/customization/EscalationForm.jsx
lib/desk/escalation-settings.js

# Desk track
components/desk/InboxShell.jsx
components/desk/DeskThread.jsx
components/desk/DeskDetailsRail.jsx      # new
components/desk/SuggestedReplyCard.jsx   # new
lib/services/handoff.service.js          # summary LLM
lib/services/desk-suggest.service.js     # new
```

---

# Part 11 — Decisions (confirm)

### Escalation (E)

| # | Sawal | Recommendation |
|---|--------|----------------|
| 1 | Pehla E ship? | **E1** toggle + page |
| 2 | High-stakes default | try_ai_first |
| 3 | Frustration streak | ≥ 2 |

### Desk (D)

| # | Sawal | Recommendation |
|---|--------|----------------|
| 4 | Pehla D ship? | **D1** details rail (fast win) |
| 5 | Biggest Botpress gap? | **D3** suggested reply + better summary |
| 6 | Attachments from desk? | D4 — yes with same security as embed |
| 7 | Team / presence / snooze? | Defer (D5 / Teams) |
| 8 | Ship order | E1 → D1 → D2 → D3 → E2 → E3 → D4… **or** D1–D3 pehle if Inbox UX pehle chahiye |

---

# Part 12 — Progress

### Escalation

- [ ] E0 defaults helper  
- [ ] E1 toggle + UI  
- [ ] E2 rules  
- [ ] E3 procedure / ack  
- [ ] E4 polish  

### Desk UI

- [ ] D1 details rail  
- [ ] D2 frustrated + filters  
- [ ] D3 summary + suggested reply  
- [ ] D4 next + attach  
- [ ] D5 CRM lite / await (optional)  

---

## Related

| Doc | Role |
|-----|------|
| [`F12_HUMAN_DESK.md`](F12_HUMAN_DESK.md) | Desk shipped |
| [`ARCHITECTURE_ACTIONS_AND_DESK.md`](ARCHITECTURE_ACTIONS_AND_DESK.md) | Security / edge |
| Botpress Escalation + Desk screenshots | UX reference only |

---

*Core handoff already live. Yeh plan = (1) Escalation settings + (2) Desk operator gaps vs Botpress. Approve E1 and/or D1–D3 in chat — phir implement.*
| [`ORCHESTRATOR_LAYER_PLAN.md`](ORCHESTRATOR_LAYER_PLAN.md) | O01 done — escalation config ≠ Orchestrator fork |
