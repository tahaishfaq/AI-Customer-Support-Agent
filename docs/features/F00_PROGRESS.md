# F00 — Local progress log

**Started:** Aug 27, 2026  
**Parent:** [`F00_DOD_DEMO_BUFFER.md`](F00_DOD_DEMO_BUFFER.md)  
**Live URL:** https://ai-customer-support-agent-ashen.vercel.app  

> F11–F14 + **F11-U** engineering shipped. Buffer = prove **live** DoD + demo rehearsal.  
> **Next:** deploy latest → full live D3 + live DoD UI ticks.

---

## Phase progress

| Phase | Status | Notes |
|-------|--------|-------|
| A Scope | ✅ | Locked; identity guardrails unchanged |
| B DoD §30 | 🟡 Local auto Aug 30 · **live ticks owner** | `npm run test:f00-local` |
| C Deliverables | 🟡 README + DS + API filled | Deck / prod seed = owner |
| D Demo script | ✅ | F00 Phase D + **B26** `npm run test:f00-b26` **18/18** Aug 30 |
| E Live checks | 🟡 | Health ✅ · demo/B26 pack **404 until deploy** |
| F Responsive | 🟡 | Redesign shipped; re-check 375px before talk |
| G Repo review | 🟡 | No `.env` in git; teammate review pending |
| H Done when | ⬜ | Lead sign-off after live rehearsal |

### Engineering closed

| Track | Status |
|-------|--------|
| F11 core + redesign + UX-1–4 | ✅ |
| F11-U Universal (A–C + D script) | ✅ `npm run test:f11u` · `test:f00-b26` · **local D3 ✅** |
| F12 Desk · F13 Tools · F14 consent | ✅ |
| UI D0–D9 | ✅ |

---

## DoD §30 — verification board

Tick **Live** on production/preview. Local = this machine.

| # | Item | Local | Live | How |
|---|------|-------|------|-----|
| 1 | Register / login | ✅ Aug 30 `test:f00-local` | ⬜ | `/register` → `/login` |
| 2 | Create agent | ✅ | ⬜ | Agents → New |
| 3 | Add knowledge | ✅ TEXT | ⬜ | Knowledge → TEXT FAQ |
| 4 | Chat with AI | ✅ studio | ⬜ | Test tab |
| 5 | Conversations in DB | ✅ persisted | ⬜ | Conversations / Inbox |
| 6 | Message metadata | ✅ timestamps | ⬜ | Response time in UI/API |
| 7 | Categorized | ✅ classify | ⬜ | After chat → category |
| 8 | Sentiment | ✅ Aug 30 `test:f00-local` | ⬜ | Conversation / Analytics |
| 9 | Analytics calc | ✅ dashboard API | ⬜ | `/analytics` numbers |
| 10 | Dashboard charts | ✅ API shape | ⬜ | KPIs + charts render (UI) |
| 11 | Business insights | ✅ topics/sentiment/trends API | ⬜ | Panels on live |
| 12 | Responsive | ⬜ manual | ⬜ | 375 + 1280 |
| 13 | Critical errors | ✅ friendly 401 JSON | ⬜ | Friendly 401 / LLM fail |
| 14 | Deployed | — | ✅ | Health `database:ok` |
| 15 | README complete | ✅ | ✅ | Setup, env, embed, CI, API, DS |
| 16 | GitHub organized | 🟡 | ⬜ | No secrets; branch hygiene |
| 17 | Code reviewed | ⬜ | ⬜ | Both interns |
| 18 | Demo prepared | ✅ script + B26 auto | ⬜ rehearse live | Phase D + `test:f00-b26` |

**Aug 30 local runs:**  
- `npm run test:f00-local` → **9/9** (DoD #1–4, #5–8, #9–11, #13, #15)  
- `npm run test:f00-b26` → **18/18** (guest PCL-100 + setUser ORD-100 + refuse ORD-999)  
- `npm run test:f11u-live-d3` on **localhost** → **11/11** full dual-auth  
- **Vercel live D3** → partial: health ✅ · refuse cross-user ✅ · **PCL-100 + B26 pack 404** (deploy)

---

## F11-U Live D3 tick

| Check | Local | Live (Vercel) |
|-------|-------|---------------|
| Health | ✅ | ✅ |
| `/api/demo/orders/PCL-100` | ✅ Out for delivery | ❌ 404 — **deploy** |
| Install `universal:B26` | ✅ | ❌ 404 — **deploy** |
| Guest track + confirm | ✅ | ⬜ after deploy |
| setUser + ORD-100 | ✅ | ⬜ after deploy |
| Refuse friend ORD-999 | ✅ | ✅ (policy, no tool) |

**Command:** `LIVE_URL=https://ai-customer-support-agent-ashen.vercel.app npm run test:f11u-live-d3`

---

## Commands (buffer week)

```bash
# Local DoD (automated rows)
npm run test:f00-local
npm run test:f00-b26
npm run test:f11u

# Local D3 (same as B26 embed beats)
LIVE_URL=http://127.0.0.1:3000 npm run test:f11u-live-d3

# Live D3 (after deploy)
LIVE_URL=https://ai-customer-support-agent-ashen.vercel.app npm run test:f11u-live-d3

# Live product smoke
TEST_BASE_URL=https://ai-customer-support-agent-ashen.vercel.app npm run test:product
```

---

## Owner TODO (cannot automate)

1. **Deploy** latest (live needs `/api/demo/orders/PCL-100` + `action-packs` + F11-U migrations).  
2. Re-run `npm run test:f11u-live-d3` on Vercel → expect **11/11**.  
3. Walk Phase D demo **twice** on live URL (User + Admin profiles).  
4. Tick DoD rows still ⬜ on **live** UI (charts, responsive, sentiment panels).  
5. Confirm prod Neon has all migrations + `seed:admin` once.  
6. Optional: 5–9 slide deck from F00 §7 outline.  
7. Teammate README zero → chat smoke.  
8. Lead sign-off.
