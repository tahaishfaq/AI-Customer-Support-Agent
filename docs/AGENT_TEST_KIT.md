# Agent testing kit — Hapy Co support

Use this file to set up one test agent, add one knowledge base, and run fixed chat scripts.

## Reply language rule (product behavior)


| Knowledge bases                                 | Agent reply language                        |
| ----------------------------------------------- | ------------------------------------------- |
| No knowledge                                    | **English** (default)                       |
| All documents in the **same** language          | That language (English / Urdu / Roman Urdu) |
| **Multiple** documents with **mixed** languages | **English** (default)                       |


The model should stay on that language even if the customer greets in another language.

---

## 1. Create / edit agent

**Name**

```text
Hapy Co Support
```

**Description**

```text
Test agent for Hapy Co company FAQ — English knowledge.
```

**System prompt** (copy into Agent → System Prompt)

```text
You are the official customer support agent for Hapy Co, a technology and design company that builds custom software and AI automation for startups and growing businesses.

Rules:
- Answer only from the knowledge base. Do not invent pricing, clients, or timelines.
- Be warm, clear, and professional.
- Prefer short paragraphs and Markdown bullet lists when listing services.
- If the answer is not in the knowledge, say you do not have that detail and offer a Strategy Call with Hamid M. Chishty.
- Never claim you are human.
```

**Welcome message**

```text
Hi! Welcome to Hapy Co. How can I help you today?
```

---



## 2. Knowledge base (TEXT) — add this as one document

**Document name**

```text
Hapy Co Company FAQ
```

**Content** (paste into Add text knowledge)

```text
# About Hapy Co

Hapy Co is a technology and design company. We help startups and established businesses build custom software and AI automation.

We have worked with teams from communities such as Y Combinator, Techstars, and Sequoia Capital portfolio companies.

Founder contact for strategy: Hamid M. Chishty — book a Strategy Call when the customer needs custom scoping.

# Services

- MVP Development: design and ship a first product version fast.
- Business Systems Automation: connect tools and reduce manual work.
- AI Integration: add AI assistants, workflows, and support bots into products.
- Website Migration: move and modernize existing websites with less downtime.

# Support hours

- Monday to Friday: 9:00 AM – 6:00 PM (PKT)
- Weekend: email only, reply next business day

# Pricing

- We do not publish fixed public prices.
- Every project starts with a short Strategy Call, then a written proposal.
- If asked for a number without a call, say pricing depends on scope and invite them to book a Strategy Call.

# Common answers

Q: What does Hapy Co do?
A: We build custom software and AI automation — MVPs, business systems, AI integration, and website migration.

Q: Who should I talk to for a new project?
A: Hamid M. Chishty via a Strategy Call.

Q: Do you only work with startups?
A: No. We work with startups and established businesses.
```

---



## 3. Optional second knowledge (to test mixed → English default)

Add this **only** when you want to verify mixed-language defaulting. With **both** English FAQ + this Urdu note, replies should stay **English**.

**Document name**

```text
Hapy Co Urdu Note (mixed-language test)
```

**Content**

```text
ہپی کو ایک ٹیکنالوجی کمپنی ہے۔ یہ نوٹ صرف مکسڈ لینگویج ٹیسٹ کے لیے ہے۔
اگر یہ دستاویز انگریزی FAQ کے ساتھ موجود ہو تو ایجنٹ کو ڈیفالٹ انگریزی میں جواب دینا چاہیے۔
```

After the mixed test, **delete** this Urdu note so the agent goes back to single-language English knowledge.

---



## 4. Testing chats (run in Chat widget)

Start a **New chat** for each script. Keep the same agent. Compare answers to the Expected notes.

### Chat A — Greeting


| #   | You say | Expected                                 |
| --- | ------- | ---------------------------------------- |
| A1  | `hello` | Short English welcome / offer to help    |
| A2  | `ہیلو`  | Still **English** (knowledge is English) |




### Chat B — Company basics


| #   | You say                           | Expected                                                    |
| --- | --------------------------------- | ----------------------------------------------------------- |
| B1  | `What does Hapy Co do?`           | Mentions custom software / AI automation; may list services |
| B2  | `Do you only work with startups?` | No — startups and established businesses                    |
| B3  | `Who is Hamid?`                   | Founder / Strategy Call contact                             |




### Chat C — Services


| #   | You say                       | Expected                                                              |
| --- | ----------------------------- | --------------------------------------------------------------------- |
| C1  | `What services do you offer?` | MVP, automation, AI integration, website migration (Markdown list OK) |
| C2  | `Do you help with AI bots?`   | Yes — under AI Integration                                            |
| C3  | `Can you migrate my website?` | Yes — Website Migration                                               |




### Chat D — Pricing & limits


| #   | You say                                  | Expected                                                 |
| --- | ---------------------------------------- | -------------------------------------------------------- |
| D1  | `How much does an MVP cost?`             | No fixed public price; Strategy Call / proposal          |
| D2  | `What are your support hours?`           | Mon–Fri 9–6 PKT; weekend email                           |
| D3  | `What is your office address in Lahore?` | Should say it does **not** have that detail in knowledge |




### Chat E — Full sample conversation (one thread)

Copy these turns in order in a single chat:

```text
User: Hi
Agent: (English greeting)

User: Tell me about Hapy Co
Agent: (company summary from knowledge)

User: List your services
Agent: (bullet list of 4 services)

User: I need an AI support bot for my SaaS
Agent: (points to AI Integration + Strategy Call)

User: Send me a price list
Agent: (no public price list; book Strategy Call)
```



### Chat F — Mixed knowledge language check

1. Add the optional Urdu note (section 3) **while** English FAQ is still present.
2. New chat → send: `What services do you offer?`
3. Expected: answer in **English** (mixed KB → default English).
4. Delete the Urdu note afterward.

---



## 5. Quick pass / fail checklist

- [ ] Agent created with system prompt from this file
- [ ] Knowledge `Hapy Co Company FAQ` added
- [ ] Chat A–E run; answers stay in English
- [ ] Unknown facts are refused (no invented address/pricing)
- [ ] Markdown lists render cleanly in the widget
- [ ] (Optional) Chat F mixed KB → English default
- [ ] History icon can reopen a past test chat and resume

---

## 5b. Studio Test tab (Ask yourself auto-run)

Use **Agents → [agent] → Test** (`/agents/[id]/test`).

### Ask yourself

1. Add your own questions (up to 20). Blanks are skipped.
2. Click **Run test**.
3. Each question is sent only after the previous reply finishes (same conversation).
4. **Pause** / **Resume** / **Stop** anytime.
5. If a send errors, the run **pauses** — Resume continues from that question.

### Question pack

- Edit the starter lines, or **Generate with AI** / **Regenerate**.
- **Send** on a single line still works (one question, not the full queue).

- [ ] Added 5–10 Ask yourself questions
- [ ] Run test completed (or paused / stopped on purpose)
- [ ] Same chat shows Q1, answering, Q2, … in order

---



## 6. Notes

- Existing agents keep their old system prompt until you edit them.
- Language is detected from knowledge **document text**, not from the chat message alone.
- For a Roman Urdu-only agent, use a knowledge document written in Roman Urdu (and no English FAQ) — then replies should follow Roman Urdu.

