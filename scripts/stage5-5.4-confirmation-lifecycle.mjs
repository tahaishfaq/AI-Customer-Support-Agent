/**
 * Stage 5.4 — Confirmation lifecycle / actor-binding tests.
 * Run: npx tsx --import ./scripts/register-aliases.mjs scripts/stage5-5.4-confirmation-lifecycle.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, ".tmp");

const { hashArgs } = await import("../lib/actions/identity.js");
const {
  CONFIRMATION_LIFECYCLE,
  statusToLifecyclePhase,
  bindConfirmationActor,
  createPendingConfirmation,
  approveConfirmation,
  claimApprovedConfirmation,
  getApprovedConfirmation,
} = await import("../lib/services/confirmation.service.js");

const results = [];
function record(row) {
  results.push({ ts: new Date().toISOString(), phase: "5.4", ...row });
}
function pass(id, evidence, actual = {}) {
  record({ id, status: "PASS", evidence, actual });
}
function fail(id, evidence, actual = {}) {
  record({ id, status: "FAIL", evidence, actual });
}

// Lifecycle mapping
{
  const map = [
    ["PENDING", "PENDING"],
    ["APPROVED", "CONFIRMED"],
    ["CONSUMED", "CONSUMED"],
    ["DENIED", "DENIED"],
    ["EXPIRED", "EXPIRED"],
  ];
  let ok = true;
  for (const [status, phase] of map) {
    if (statusToLifecyclePhase(status) !== phase) ok = false;
  }
  if (
    ok &&
    CONFIRMATION_LIFECYCLE.CONFIRMED === "CONFIRMED" &&
    CONFIRMATION_LIFECYCLE.PENDING === "PENDING"
  ) {
    pass(
      "S5.4-LIFECYCLE-MAP",
      "PENDING→PENDING, APPROVED→CONFIRMED, CONSUMED→CONSUMED"
    );
  } else {
    fail("S5.4-LIFECYCLE-MAP", "Lifecycle map wrong");
  }
}

// Actor bind unit
{
  try {
    bindConfirmationActor({
      conversationSubject: "user-A",
      evidenceSubject: "user-B",
    });
    fail("S5.4-ACTOR-MISMATCH", "Expected throw on forged evidence subject");
  } catch (err) {
    if (err?.details?.code === "CONFIRMATION_ACTOR_MISMATCH" || err?.status === 403) {
      pass(
        "S5.4-ACTOR-MISMATCH",
        "Forged evidence.userSubject rejected (CONFIRMATION_ACTOR_MISMATCH)"
      );
    } else {
      fail("S5.4-ACTOR-MISMATCH", String(err?.message || err));
    }
  }

  const bound = bindConfirmationActor({
    conversationSubject: "user-A",
    evidenceSubject: "user-A",
  });
  if (bound === "user-A") {
    pass("S5.4-ACTOR-MATCH", "Matching actor binds to conversation subject");
  } else {
    fail("S5.4-ACTOR-MATCH", "Bind returned unexpected", { bound });
  }

  const studio = bindConfirmationActor({
    conversationSubject: null,
    evidenceSubject: null,
  });
  if (studio === null) {
    pass("S5.4-ACTOR-STUDIO", "Studio (no customerSubject) may resolve without actor");
  } else {
    fail("S5.4-ACTOR-STUDIO", "Unexpected studio bind", { studio });
  }
}

// Live DB lifecycle + actor
if (!process.env.DATABASE_URL) {
  fail("S5.4-DB", "DATABASE_URL missing");
} else {
  const prisma = (await import("../lib/prisma.js")).default;
  try {
    const action = await prisma.agentAction.findFirst({
      where: { enabled: true },
      select: { id: true, agentId: true },
    });
    let conv = action
      ? await prisma.conversation.findFirst({
          where: { agentId: action.agentId },
          select: { id: true, agentId: true, customerSubject: true },
        })
      : null;

    if (!action || !conv) {
      record({
        id: "S5.4-DB-SKIP",
        status: "UNEXECUTED",
        evidence: "No enabled action + conversation",
      });
    } else {
      // Stamp a subject for actor tests
      const subject = `stage54-${Date.now()}`;
      conv = await prisma.conversation.update({
        where: { id: conv.id },
        data: { customerSubject: subject },
        select: { id: true, agentId: true, customerSubject: true },
      });

      const args = { stage54: true, t: Date.now() };
      const pending = await createPendingConfirmation(
        conv.id,
        { actionId: action.id },
        args
      );
      if (
        pending.status === "PENDING" &&
        pending.lifecyclePhase === "PENDING" &&
        pending.userSubject === subject
      ) {
        pass(
          "S5.4-CREATE-STAMP",
          "PENDING created with lifecyclePhase + conversation userSubject stamp"
        );
      } else {
        fail("S5.4-CREATE-STAMP", "Create stamp incomplete", pending);
      }

      // Forged actor on approve
      let forgedBlocked = false;
      try {
        await approveConfirmation(pending.id, conv.id, {
          userSubject: "evil-other-user",
        });
      } catch (err) {
        forgedBlocked =
          err?.details?.code === "CONFIRMATION_ACTOR_MISMATCH" ||
          err?.status === 403;
      }
      if (forgedBlocked) {
        pass("S5.4-LIVE-ACTOR-DENY", "Live approve rejects mismatched actor");
      } else {
        fail("S5.4-LIVE-ACTOR-DENY", "Forged actor was accepted");
      }

      const approved = await approveConfirmation(pending.id, conv.id, {
        userSubject: subject,
      });
      if (
        approved.status === "APPROVED" &&
        approved.lifecyclePhase === "CONFIRMED" &&
        approved.userSubject === subject
      ) {
        pass(
          "S5.4-LIVE-CONFIRM",
          "Approve → APPROVED / lifecyclePhase CONFIRMED with actor stamp"
        );
      } else {
        fail("S5.4-LIVE-CONFIRM", "Approve lifecycle wrong", approved);
      }

      const h = hashArgs(args);
      const claimed = await claimApprovedConfirmation(
        conv.id,
        { actionId: action.id },
        h,
        { expectedAgentId: conv.agentId }
      );
      if (claimed?.status === "CONSUMED" && claimed.lifecyclePhase === "CONSUMED") {
        pass("S5.4-LIVE-CONSUME", "Claim → CONSUMED lifecycle phase");
      } else {
        fail("S5.4-LIVE-CONSUME", "Consume phase wrong", claimed);
      }

      const replay = await getApprovedConfirmation(
        conv.id,
        { actionId: action.id },
        h,
        { expectedAgentId: conv.agentId }
      );
      if (!replay) {
        pass("S5.4-LIVE-REPLAY", "Replay after CONSUMED still rejected");
      } else {
        fail("S5.4-LIVE-REPLAY", "Replay possible", replay);
      }

      // Actor drift: APPROVED row with mismatched userSubject cannot be claimed
      const args2 = { stage54: "drift", t: Date.now() };
      const p2 = await createPendingConfirmation(conv.id, { actionId: action.id }, args2);
      await approveConfirmation(p2.id, conv.id, { userSubject: subject });
      await prisma.actionConfirmation.update({
        where: { id: p2.id },
        data: { userSubject: "drifted-actor" },
      });
      const drifted = await claimApprovedConfirmation(
        conv.id,
        { actionId: action.id },
        hashArgs(args2),
        { expectedAgentId: conv.agentId }
      );
      if (!drifted) {
        pass(
          "S5.4-LIVE-ACTOR-DRIFT",
          "Claim rejected when confirmation.userSubject ≠ conversation subject"
        );
      } else {
        fail("S5.4-LIVE-ACTOR-DRIFT", "Drifted actor still claimed");
      }
    }
  } catch (err) {
    fail("S5.4-DB-ERROR", String(err?.message || err));
  }
}

fs.mkdirSync(outDir, { recursive: true });
const failures = results.filter((r) => r.status === "FAIL");
const report = `# Stage 5.4 — Confirmation Lifecycle Hardening

Generated: ${new Date().toISOString()}

## Verdict: **${failures.length ? "FAIL" : "PASS"}**

| PASS | FAIL | UNEXECUTED | TOTAL |
| ---: | ---: | ---: | ---: |
| ${results.filter((r) => r.status === "PASS").length} | ${failures.length} | ${results.filter((r) => r.status === "UNEXECUTED").length} | ${results.length} |

## Lifecycle

\`\`\`text
PENDING (created) → APPROVED/CONFIRMED → CONSUMED
                 ↘ DENIED | EXPIRED
\`\`\`

DB keeps \`APPROVED\` for compatibility; API exposes \`lifecyclePhase: "CONFIRMED"\`.

## Hardening (on top of 5.1)

- Actor binding: evidence/existing subject must match conversation.customerSubject
- Forged \`userSubject\` on approve → \`CONFIRMATION_ACTOR_MISMATCH\`
- Claim rejects drifted actor vs conversation
- Serialize \`lifecyclePhase\` for clients
- TTL / argsHash / replay / capability bind retained from 5.1

## Results

${results.map((r) => `- **${r.id}** [${r.status}]: ${r.evidence}`).join("\n")}

## Failures

${failures.length ? failures.map((f) => `- ${f.id}: ${f.evidence}`).join("\n") : "- None"}

## Gate

- Next on request: **5.5 Source Router**
`;

fs.writeFileSync(path.join(outDir, "stage5-5.4-report.md"), report);
fs.writeFileSync(
  path.join(outDir, "stage5-5.4-results.jsonl"),
  results.map((r) => JSON.stringify(r)).join("\n") + "\n"
);
fs.writeFileSync(
  path.join(outDir, "stage5-5.4-failures.json"),
  JSON.stringify(failures, null, 2)
);
console.log(report);
process.exit(failures.length ? 1 : 0);
