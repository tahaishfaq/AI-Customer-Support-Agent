# M01 — MCP Tools: simple deep plan (approve before build)

**Status:** 📋 Planning — **awaiting your approval** (no implement until you say go)  
**Related:** F13 (backend shipped) · F14 Confirm (HTTP only) · Botpress Tools → MCP UX (your screenshots)  
**Rule:** One phase → test → next. **Security first.**

---

# Part A — Simple explanation (pehle yeh padho)

## MCP kya hai? (1 minute)

**MCP = Model Context Protocol** — ek standard tareeqa jisse bahar ka **tool server** Aide agent ko tools deta hai.


| Bina MCP                                     | MCP ke sath                                               |
| -------------------------------------------- | --------------------------------------------------------- |
| Har API ke liye HTTP tool manually banate ho | Server pe already tools hain; Aide **discover** karta hai |
| Har service alag config                      | Ek **URL** (+ auth) → tools list aa jati hai              |


Botpress docs ([Tools & integrations → MCP](https://botpress.com/docs/viber/build/tools-and-integrations/#mcp-servers)):

> Connect MCP server → configure URL + auth → **enable individual tools** the agent should use.  
> Connected tools available hote hain, lekin agent **automatically** call nahi karta — Instructions mein batana padta hai kab use kare.  
> Test before publish. Secrets sirf config/OAuth mein — chat mein paste mat karo.

**Aide mein yeh same idea hai** — HTTP tools alag tab, MCP alag tab.

---



## Teen alag cheezein (confusion yahan hoti hai)


| Cheez          | Kaun hai                                                         | Example                                           |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| **MCP Server** | Bahar ka box jo tools expose karta hai                           | GitHub MCP, Notion MCP, Aide demo `/api/demo/mcp` |
| **MCP Tool**   | Us box ke andar ek action                                        | `get_demo_time`, `list_issues`                    |
| **Agent call** | Chat mein model tool pick karta hai → Aide server call karta hai | Visitor: “abhi time kya hai?” → `get_demo_time`   |


Owner **server connect** karta hai. Visitor sirf **chat** karta hai — URL/secret nahi.

---



## Exact happy flow (jo chahiye)

```
1. Owner → Agent → Tools → MCP
2. Catalog se pick (GitHub…) YA Custom URL
3. Auth (None / Bearer / Header / baad mein OAuth)
4. Test connection (tools/list) → Save
5. Discovered tools dikhein → Owner READ tools ENABLE kare
6. (Optional) System prompt / instructions mein likho kab use kare
7. Studio Test / embed chat → sawal
8. Model tool choose kare
9. Aide → MCP server tools/call
10. Result model ko → visitor ko jawab
```

**WRITE tools** (create/update/delete): pehle visitor **Confirm** → phir call  
(Aaj Aide mein MCP WRITE confirm **missing** — isliye WRITE fail-closed / blocked.)

---



# Part A2 — HTTP + MCP dono on hon to kya hoga? (aapka naya rule)



## Simple idea

Owner kabhi **HTTP tools** bhi on karta hai, kabhi **MCP tools** bhi.  
Visitor ko farq nahi pata — usko **sirf sahi, short jawab** chahiye jo usne poocha.

Aide ko decide karna hai:

1. **Kaun sa tool call kare** (fast / sasta / zyada reliable)
2. **Jawab mein kya dikhaye** (sirf poocha hua — extra data leak nahi)



## Aaj kya hota hai (problem)

- Dono HTTP + MCP tools model ko **ek list** mein milte hain  
- Model khud pick karta hai — kabhi **2 tools**, kabhi **galat / mehnga** tool  
- Alag “fast vs cheap” ranking **nahi** hai  
- Over-share risk: tool zyada fields return kare → model visitor ko extra bata de



## Target policy (security + cost)

```
User question
    │
    ▼
Tool router (Aide rules, not “trust the LLM alone”)
    │
    ├─ 0 tools needed? → sirf knowledge / prompt se jawab
    ├─ 1 clear match? → wahi ek tool
    └─ HTTP aur MCP dono same kaam? → pick by score
           score = speed + cost + owner preference + risk
    │
    ▼
At most 1 primary tool call for that question (default)
    │
    ▼
Result → Answer filter
    • Sirf us fields ka use jo sawal ke liye zaroori
    • Extra PII / internal IDs mat bolo
    • “By the way…” / upsell / random extras mat add karo
```



### Scoring (simple, implementable)

Har enabled tool pe metadata (defaults):


| Signal              | Prefer                                                             |
| ------------------- | ------------------------------------------------------------------ |
| **Latency**         | Pehle successful, tez (rolling avg `ToolRun.durationMs`)           |
| **Cost**            | Kam steps / kam tokens; HTTP simple GET often sasta than heavy MCP |
| **Owner fine-tune** | Optional `priority` 1–100 on tool (HTTP + MCP) — higher wins       |
| **Risk**            | READ > WRITE; confirm-needed tools last resort                     |
| **Fit**             | Name/description match sawal se — weak match mat chalao            |


**Default tie-break:** owner `priority` → lower risk → better latency history → HTTP over MCP if scores equal (HTTP usually thinner/cheaper) — **configurable**.

### Answer discipline (security)

System / tool-loop rules (existing grounding extend):

1. Visitor ko **sirf jawab do jo sawal ne manga**
2. Tool raw dump mat forward karo
3. Secrets, full tokens, internal IDs, other customers’ data **kabhi nahi**
4. Agar tool zyada data laaye → model ko instruction: extract only needed fields
5. Extra offers / multi-tool “research” default **off** unless owner allows



### Phase for this

**Phase R1 — Tool arbitration + tight answers** (UX-1/UX-2 ke baad, M1 se pehle ya saath)

- Tool descriptions mein cost/latency hints  
- Optional `priority` field  
- Prompt: one-tool preference + answer-only-asked  
- Soft cap: max tool calls per turn (already max steps — tighten default)  
- Later: hard router if LLM still double-calls

---



# Part A3 — MCP UI: Custom + **4 common** (not 30)

Botpress jaisi lambi list **nahi**. Abhi:


| #     | Card              | Kyun (support agents)                         | Day-1 auth                         |
| ----- | ----------------- | --------------------------------------------- | ---------------------------------- |
| —     | **Custom MCP**    | Koi bhi URL                                   | None / Bearer / Header             |
| —     | **Aide demo MCP** | Local test                                    | None                               |
| **1** | **GitHub**        | Issues / PRs / triage                         | Bearer (PAT) first; OAuth later M3 |
| **2** | **Notion**        | Docs / KB-style pages                         | Bearer / integration token         |
| **3** | **Linear**        | Tickets / issues for product teams            | Bearer (API key)                   |
| **4** | **Stripe**        | Payment / subscription lookups (careful READ) | Bearer (restricted key)            |


Baaki (Sentry, HubSpot, Shopify, …) = **addons later** — catalog file mein `comingSoon: true` optional, enable mat karo jab tak URL+auth docs ready.

Har common card = prefilled name + docs link + auth hint + recommended URL (jab public MCP endpoint known ho). Agar official remote URL unstable ho → card “paste your MCP URL” + setup doc.

---



# Part B — Aide aaj kahan khara hai? (honest)



## Backend = mostly ready ✅


| Piece                                                           | Status |
| --------------------------------------------------------------- | ------ |
| DB: `AgentMcpServer`, `AgentMcpTool`                            | ✅      |
| APIs: create / list / probe / enable tool                       | ✅      |
| Client: `tools/list` + `tools/call` (HTTP JSON-RPC)             | ✅      |
| Demo MCP: `/api/demo/mcp` (`get_demo_time`, `create_demo_note`) | ✅      |
| Chat tool-loop MCP READ invoke                                  | ✅      |
| SSRF, frozen host, kill switch, audit, rate limit               | ✅      |
| Auth: None / Bearer / Header                                    | ✅      |




## Owner UI = band ❌ (important)

**Tools → MCP tab abhi “Coming soon” dikhata hai.**  
`McpServersPanel.jsx` code **maujood** hai lekin **mount nahi** (tests bhi “Coming soon” expect karti hain).

Matlab: APIs se MCP chal sakta hai, lekin product UI se owner connect **nahi** kar sakta jab tak Phase **UX-1** na khule.

## Badi security gap


| HTTP WRITE         | MCP WRITE                                    |
| ------------------ | -------------------------------------------- |
| F14 Confirm card ✅ | Confirm path **nahi** → call **deny** (safe) |


Isliye pehle READ MCP connect; WRITE tab jab Confirm (Phase M1) ship ho.

---



# Part C — Botpress pics vs Aide (gap map)

Aapke screenshots se Botpress MCP UX:


| Botpress                                                         | Aide aaj                                   | Plan mein                                    |
| ---------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| MCP catalog (GitHub, Notion, Stripe, …)                          | Nahi — sirf custom/demo URL                | **UX-2 Catalog** (curated list + known URLs) |
| Search MCP servers                                               | Nahi                                       | UX-2                                         |
| Custom MCP: Name, Transport HTTP/SSE, URL, Auth, Enabled         | Panel code mein partial; UI unmounted      | **UX-1** remount + polish                    |
| **Test connection** before Save                                  | Probe mostly **after** save                | UX-1: test-before-save                       |
| GitHub **OAuth** “Connect with OAuth” + redirect URI + Client ID | Nahi (`OAUTH2` missing)                    | **M3 OAuth** (baad) — pehle Bearer/Header    |
| Enable tools after connect                                       | API + panel logic hai                      | UX-1                                         |
| “Tools via tags in instructions”                                 | Hum system prompt / instructions pe depend | Docs + copy in UX-1                          |


**Important product choice (Botpress jaisa catalog):**

Aide **GitHub/Notion ka official MCP host nahi** karega pehle din. Catalog = **shortcuts**:

- Known public MCP endpoint URL (agar provider deta ho)  
- Auth type hint (OAuth vs token)  
- Docs link

Owner phir bhi **apna** token/OAuth deta hai.  
Agar provider sirf OAuth + dynamic registration support karta ho (Botpress error jaisa), Aide ko bhi OAuth app + redirect chahiye — woh **M3** hai, pehli ship nahi.

---



# Part D — Runtime flow (exact, files ke sath)

```
Visitor / Studio message
        │
        ▼
chat route → chat.service.js
        │
        ▼
tool-loop.js
  • HTTP actions load
  • MCP enabled tools load  ← mcp.service listEnabledMcpToolsForAgent
  • OpenAI tools[] banate hain (MCP name: mcp_<server>_<tool>)
        │
        ▼
Model tool_call decide karta hai
        │
        ▼
invokeOneTool()
  • args validate
  • policy (READ ok / WRITE needs APPROVED confirm)
  • agar MCP → callMcpTool() in lib/mcp/client.js
        │
        ▼
Remote MCP (ya /api/demo/mcp)
  initialize → tools/call
        │
        ▼
Result → model → final answer
(+ ToolRun row with mcpToolId)
```

**Owner connect flow (target after UX-1):**

```
Tools → MCP
  → Add demo OR catalog card OR Custom
  → Name + URL + Auth
  → Test connection (tools/list)     ← fail = mat save / clear error
  → Save server (frozenHost set)
  → Tool list: enable READ tools
  → Studio: “what time is it?” (demo)
  → See tool call in answer
```

---



# Part E — Security (short, money-grade discipline)

Kabhi mat todo:

1. Private IP / metadata URL (SSRF)
2. Client ko secret wapas
3. Saari discovered tools auto-enable
4. Redirect pe trust karke WRITE chalana
5. Confirm ke baghair MCP WRITE
6. Tool result Knowledge mein auto-save

Pehle se Aide mein: SSRF, frozen host, default `enabled:false`, kill switch, rate limit, audit.

---



# Part F — Phased plan (approve → implement)

Har phase ke baad **test**, phir agla.

---



## Phase UX-1 — MCP tab kholo (must-have) ⭐

**Goal:** Owner UI se demo + custom MCP connect karke READ tool chat mein chale.

**Build**

1. `ActionsForm` se “Coming soon” hatao → `McpServersPanel` mount
2. Smokes update (`test-f13t3` ab panel expect kare)
3. Dialog: Name, URL, Transport (HTTP), Auth (None/Bearer/Header), Enabled
4. **Test connection** pehle (probe without durable save **ya** save draft + probe — prefer test then save)
5. Tool toggles; WRITE tools UI pe “Needs confirm (soon)” + disable enable **or** allow enable but runtime deny (clear error)
6. Empty state: “Add Aide demo MCP” one-click
7. Short help: “Enable tools, then mention them in instructions if the agent never calls them”

**Test gate**

- [ ] MCP tab panel dikhe (Coming soon nahi)  
- [ ] Demo MCP add → probe → enable `get_demo_time` → Studio jawab with tool  
- [ ] Bad URL → SSRF / clear error  
- [ ] Kill switch off → no MCP calls  
- [ ] WRITE still cannot complete outbound call  

**Exit:** Aap apne agent ko MCP se **READ** tools connect kar sakte ho.

---



## Phase UX-2 — Catalog: Custom + 4 common only

**Goal:** Botpress jaisi lambi marketplace **nahi** — sirf **Custom + Aide demo + 4 cards**.

**4 cards (locked recommendation):** GitHub · Notion · Linear · Stripe  

**Build**

- `lib/mcp/catalog.js` — exactly these entries + `custom` + `aide-demo`  
- Each: name, short blurb, icon, authHint (`bearer`), docsUrl, `defaultUrl` or null, `comingSoon` if URL unknown  
- Click → prefill New MCP dialog (name/url/auth)  
- No OAuth buttons until M3 — copy: “Paste personal access token / API key as Bearer”  
- Search filters within this small list only

**Test gate**

- [ ] Exactly 4 common + custom + demo visible (not 20+)  
- [ ] Prefill works; bad token → clear probe error  
- [ ] Adding a 5th live card requires an explicit catalog change  

---



## Phase R1 — HTTP vs MCP pick + tight visitor answers ⭐

**Goal:** Dono configured hon to agent **ek best tool** choose kare; visitor ko **sirf poocha hua** jawab.

**Build**

1. Optional `priority` (int) on `AgentAction` + `AgentMcpTool` (default 50)
2. When exposing tools to the model: sort by priority; put low-priority / high-risk last
3. Prompt rules (prompt-builder / tool-loop overlay):
  - Prefer **one** tool call per user question unless necessary  
  - If HTTP and MCP both fit, prefer higher priority, else lower latency history, else HTTP  
  - Answer **only** what the user asked; do not volunteer extra tool fields
4. Soft: reduce max tool steps default for support chat
5. Log which tool won (audit) for later tuning

**Test gate**

- [ ] Same intent, HTTP + MCP enabled → typically **one** call in studio  
- [ ] Over-sharing fixture: fat tool JSON → reply omits unrelated fields  
- [ ] Owner raises MCP priority → MCP preferred  

**Exit:** Cost/speed/fine-tune knobs exist; security answer discipline on.

---



## Phase M1 — MCP Confirm (WRITE safe) ⭐ security

**Goal:** F14 jaisa Confirm card MCP WRITE ke liye.

**Build**

- `ActionConfirmation.mcpToolId` (XOR `actionId`)  
- Tool-loop PENDING confirm for MCP  
- Same chat Confirm/Cancel UI  
- Evidence list shows MCP tool name

**Test gate**

- [ ] WRITE → Confirm → Approve → `tools/call`  
- [ ] Deny → no call  
- [ ] HTTP F14 regressions green  

**Exit:** WRITE MCP enable karna safe.

---



## Phase M2 — Test tool + re-probe drift

**Goal:** Owner sample args se `tools/call` (studio); schema change pe stale badge.

**Test gate:** test READ; SSRF on test; removed remote tool auto-disable.

---



## Phase M3 — OAuth (Botpress GitHub modal jaisa)

**Goal:** Selected providers ke liye “Connect with OAuth”.

**Build (heavy)**

- Aide OAuth callback URL (per env): e.g. `{APP}/api/mcp/oauth/callback`  
- Store client id/secret per catalog provider (platform env) **or** owner-pasted app credentials  
- Token → `ActionCredential`  
- Handle “no dynamic client registration” like Botpress (manual app + redirect URI copy)

**Test gate:** one provider sandbox OAuth → tools/list → one READ call.

**Note:** Is phase ke baghair bhi Custom + Bearer MCP **poora kaam** karta hai.

---



## Phase M4 — Observability

ToolRuns MCP filter, admin read-only inspect, error rates.

---



## Phase M5 — Polish + caps

Empty states, README, optional billing `maxMcpServers` (B01 ke baad).

---



# Part G — “Mujhe agent MCP se connect karna hai” — checklist

Aapke liye **minimum path** (approve UX-1 ke baad):

1. Approve **UX-1**
2. Tools → MCP → **Add Aide demo MCP**
3. Enable `get_demo_time`
4. Test studio: “What time is it?”
5. Apna remote MCP: Custom URL + Bearer/Header agar chahiye
6. WRITE tools: **M1 ke baad**

Botpress jaisa GitHub one-click OAuth: **M3** — alag approve.

---



# Part H — Decisions (aap confirm karo)


| #   | Sawal            | Recommendation                                                    | Your call |
| --- | ---------------- | ----------------------------------------------------------------- | --------- |
| 1   | Pehla implement? | **UX-1** (tab + demo + custom READ)                               | Pending   |
| 2   | Catalog          | **UX-2**: Custom + demo + **GitHub, Notion, Linear, Stripe** only | Pending   |
| 3   | HTTP+MCP both on | **R1** arbitration + answer-only-asked                            | Pending   |
| 4   | OAuth            | **M3** later                                                      | Pending   |
| 5   | WRITE UI enable  | **M1** ke baad                                                    | Pending   |
| 6   | 4 MCPs names OK? | GitHub / Notion / Linear / Stripe — change if you want            | Pending   |


**Suggested ship order after approve:** UX-1 → UX-2 → R1 → M1 → …

---



# Part I — Progress

- [ ] Decisions 1–6 locked  
- [ ] UX-1 approved + done + tested  
- [ ] UX-2 (4 common) …  
- [ ] R1 (pick best tool + tight answers) …  
- [ ] M1 …  
- [ ] M2 …  
- [ ] M3 …  
- [ ] M4 …  
- [ ] M5 …  

---



## Related files


| Path                                           | Role                    |
| ---------------------------------------------- | ----------------------- |
| `components/customization/McpServersPanel.jsx` | UI (unmounted)          |
| `components/customization/ActionsForm.jsx`     | MCP = Coming soon       |
| `lib/mcp/client.js`                            | list/call               |
| `lib/services/mcp.service.js`                  | CRUD + execute          |
| `lib/actions/tool-loop.js`                     | Chat invoke + WRITE gap |
| `app/api/demo/mcp/route.js`                    | Demo server             |
| `docs/features/F13_TOOLS_HUB.md`               | Shipped backend story   |


---

*Approve UX-1 (or full sequence) in chat — phir implement. Is doc ke baghair OAuth/catalog fake nahi lagayenge.*