# AIDE Phase 1 — Beginner Manual Test Guide

This guide checks the first Phase 1 change: internal knowledge-source details remain available to the owner’s Test/Studio view but are not shown or returned to the public embedded visitor.

## Before starting

1. Run `npm run dev`.
2. Open the owner dashboard and open the agent’s Test/Studio screen.
3. Keep a second browser tab ready for the public embed.
4. Use an agent that has at least one knowledge item, such as a return policy.

## Test 1 — Studio shows knowledge detail

1. In Test/Studio, ask: `What is your return policy?`
2. Wait until the answer finishes.
3. Look below the assistant answer.

Expected: `Used knowledge` and the knowledge title may be visible.

## Test 2 — Public embed hides knowledge detail

1. Open the public embedded agent.
2. Ask the same question: `What is your return policy?`
3. Wait until the answer finishes.

Expected: the answer is visible, but `Used knowledge`, internal source labels, and knowledge-source chips are not visible.

## Test 3 — Public answer still works

1. In the public embed, ask: `What is an API?`
2. Ask: `I want to speak to a person.`

Expected: the assistant still answers normally and handoff remains available. Hiding metadata must not hide the answer or break the composer.

## Test 4 — Verify the two surfaces are different

Ask the same knowledge question in both tabs.

Expected:

- Owner Test/Studio: answer plus knowledge detail.
- Public embed: answer only, without knowledge detail.

## If a test fails

Record the exact question, which surface failed, a screenshot, and whether the answer itself appeared. Do not copy secrets or customer data into the report.

Phase 1 is not fully complete from these manual checks alone; identity, cross-tenant, confirmation, and output-boundary tests remain required.
