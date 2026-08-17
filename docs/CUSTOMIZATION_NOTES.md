# Customization — saved references (wait for more parts)

> Do **not** plan or implement until user says so.  
> Collecting screenshots + details part by part.

Suggested product name in Hapy: **Customization** (Botpress calls this **Webchat**)

---

## Part 1 — Bot Identity ✅ (saved)

**Source:** Botpress Webchat → Bot Identity (2 screenshots)  
**Layout pattern:** Split view  

- Left: settings form  
- Right: live chat widget preview (+ floating launcher)  
- Top: section title + **Publish Changes** (Hapy may use **Save**)

### Fields to include (from screenshots)


| Field                   | Description (Botpress copy)           | UI                                                                                         |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Agent Avatar**        | Upload / change bot image             | Image upload control                                                                       |
| **Display Name**        | Name in chat header and conversations | Text input — placeholder: `My bot agent`                                                   |
| **Agent Description**   | Brief purpose / capabilities          | Textarea — placeholder: `Describe what your bot does`                                      |
| **Message Placeholder** | Placeholder in message input          | Text input — e.g. `Type your message...`                                                   |
| **Footer**              | Text at bottom of chat                | Text / markdown link — Botpress example: `[⚡️ by Botpress](…)` → Hapy should brand as Hapy |
| **Contact — Email**     | Contact info for bot                  | Email input                                                                                |
| **Contact — Phone**     | Contact info for bot                  | Phone input                                                                                |
| **Contact — Website**   | Contact info for bot                  | URL input                                                                                  |
| **Terms of service**    | Link to terms document                | URL input                                                                                  |
| **Privacy Policy**      | Link to privacy document              | URL input                                                                                  |




### Preview (right side) should reflect

- Avatar (or monogram fallback)  
- Display name in header  
- Large avatar + name in empty/welcome area  
- Message placeholder in input  
- Footer text under input  
- Floating chat launcher button



### Notes for later (Hapy adaptation)

- Keep **Hapy teal** brand — do not clone Botpress black/blue theme for our app shell  
- “by Botpress” footer → replace with Hapy branding when we build  
- Map to existing agent fields where possible (`name`, `description`, `welcomeMessage`, etc.) — decide during plan phase



### Collection checklist

- [x] Bot Identity  
- [x] Bot / Agent Appearance  
- [x] Deploy Settings / Bot Settings  
- [x] Agent Features  
- [ ] Any other Customization parts user sends  

---



## Part 2 — Agent Appearance ✅ (saved)

**Source:** Botpress Webchat → Bot Appearance (2 screenshots)  
**Hapy name:** **Agent Appearance** (user wording)  
**Layout:** Same split — left settings, right live preview + launcher  
**Top:** “Bot Appearance” / Agent Appearance + **Publish Changes**

### Fields / controls (from screenshots)


| Control                 | Description                       | UI                                                            |
| ----------------------- | --------------------------------- | ------------------------------------------------------------- |
| **Primary Color**       | Primary brand color for webchat   | Color swatch + hex input (e.g. `#3276EA`) + reset             |
| **Font**                | Primary font family for interface | Dropdown (e.g. Inter)                                         |
| **Theme Mode**          | Light vs dark appearance          | Two selectable preview cards — **Light** / **Dark**           |
| **Header Style**        | Chat header look                  | Two cards — **Dark/solid header** vs **Primary color header** |
| **Message Styling**     | Chat bubble look                  | Two cards — light bubbles vs darker bubbles                   |
| **Corner Radius**       | Roundness of UI elements          | Slider: Sharp → Round                                         |
| **Styles (Custom CSS)** | Custom CSS for webchat            | Code editor — e.g. `/* Your CSS styles here */`               |




### Preview (right side) should reflect

- Primary color on avatar / accents / launcher  
- Selected theme (light/dark widget body)  
- Selected header style  
- Selected message bubble style (when messages shown)  
- Corner radius on widget + inputs  
- Custom CSS applied to preview (later)



### Notes for later (Hapy adaptation)

- Default primary should be Hapy teal `#0b5f58` (not Botpress blue)  
- Font options should include Hapy fonts where sensible (Instrument Sans / DM Sans)  
- Custom CSS may be Phase-later / optional for MVP — decide in plan

---



## Part 3 — Bot Settings (Deploy Settings) ✅ (saved)

**Source:** Botpress Webchat → Deploy Settings (2 screenshots)  
**Hapy name:** **Bot Settings** (user wording)  
**Layout:** Same split — left settings, right live preview + launcher  
**Top:** “Deploy Settings” + **Publish Changes**

### Fields / controls (from screenshots)


| Control               | Description                     | UI                                                        |
| --------------------- | ------------------------------- | --------------------------------------------------------- |
| **Embed Code**        | Copy/paste scripts onto webpage | Read-only code block + copy (`inject.js` + config script) |
| **Chat Interface**    | How chat is added to the site   | Two cards: **Toggle** (floating) · **Embedded** (inline)  |
| **Chat Launcher**     | How visitors open chat          | Two cards: **Chat Bubble** · **Custom Element**           |
| **Button Image**      | Image for launcher button       | Upload placeholder + **“Use bot avatar”**                 |
| **Proactive Message** | Short message above chat bubble | Toggle + message preview (e.g. “Hi! 👋 Need help?”)       |




### Preview (right side) should reflect

- Toggle vs Embedded placement  
- Launcher style (bubble vs custom element)  
- Button image / bot avatar on launcher  
- Proactive message when enabled  
- Widget still shows identity/appearance from other tabs



### Notes for later (Hapy adaptation)

- Embed snippet → Hapy public key / script (Phase 7 webchat)  
- Existing chat placements (bottom-right / left / full page) map here — decide in plan  
- Proactive message optional for MVP — decide in plan

---



## Part 4 — Agent Features ✅ (saved)

**Source:** Botpress Webchat → Features (2 screenshots)  
**Hapy name:** **Agent Features** (user wording)  
**Layout:** Same split — left settings, right live preview + launcher  
**Top:** “Features” + **Publish Changes**  
**Sub-tabs:** **Chat Settings** (shown) · **Advanced Settings** (not captured yet — note if user sends later)

### Chat Settings — fields / controls (from screenshots)


| Control                        | Description                              | UI                                        |
| ------------------------------ | ---------------------------------------- | ----------------------------------------- |
| **Message Feedback**           | Thumbs up/down on bot messages           | Toggle + mini preview (message bubble)    |
| **Allow File Upload**          | Users upload/share files in chat         | Toggle + mini preview (composer with mic) |
| **Message Notification Sound** | Alert when a new message arrives         | Toggle                                    |
| **Conversation History**       | View and continue previous conversations | Toggle + mini preview (history row)       |
| **Chat History Reset**         | When to clear history in the browser     | Dropdown — e.g. **Never**                 |




### Preview (right side) should reflect

- Feedback controls on assistant messages when enabled  
- File upload affordance in composer when enabled  
- History UI when conversation history is on  
- Identity/appearance from other tabs still apply



### Notes for later (Hapy adaptation)

- We already have chat **History** in the product widget — map this toggle to that  
- File upload / feedback / sound — decide MVP vs later in plan  
- **Advanced Settings** tab content unknown until user sends it

---



## All saved parts (summary)


| #   | Hapy name        | Source                   | Status |
| --- | ---------------- | ------------------------ | ------ |
| 1   | Bot Identity     | Bot Identity             | ✅      |
| 2   | Agent Appearance | Bot Appearance           | ✅      |
| 3   | Bot Settings     | Deploy Settings          | ✅      |
| 4   | Agent Features   | Features (Chat Settings) | ✅      |


**Status:** All four parts saved. **Plan written:** [`CUSTOMIZATION_PLAN.md`](CUSTOMIZATION_PLAN.md). Waiting for **build**.