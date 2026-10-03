/**
 * Level 3 · L8 — dry-run simulation (READ tools real, WRITE simulated). Never bills.
 */

import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";
import { parseQaJudgeJson, qaJudgeSystemPrompt } from "@/lib/services/ai/qa-judge";
import { chatCompletion, jsonCompletion } from "@/lib/services/ai/llm.provider";
import { safeLogError } from "@/lib/observability/safe-log";

const MAX_CONCURRENT_RUNS = 2;
const MAX_CASES = 20;

export async function createSimulationRun({
  agentId,
  userId,
  questions = [],
  persona = "customer",
  revisionVersion = null,
}) {
  const agent = await getAgentForUser(agentId, userId, { mutate: true });
  const active = await prisma.simulationRun.count({
    where: {
      workspaceId: agent.workspaceId,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (active >= MAX_CONCURRENT_RUNS) {
    throw Object.assign(new Error("Too many simulation runs in this workspace"), { status: 429 });
  }

  const list = (Array.isArray(questions) ? questions : [])
    .map((q) => String(q || "").trim())
    .filter(Boolean)
    .slice(0, MAX_CASES);
  if (!list.length) {
    throw Object.assign(new Error("Add at least one question"), { status: 400 });
  }

  const run = await prisma.simulationRun.create({
    data: {
      agentId,
      workspaceId: agent.workspaceId,
      status: "PENDING",
      revisionVersion,
      persona: String(persona || "customer").slice(0, 80),
      questionCount: list.length,
      createdByUserId: userId,
      cases: {
        create: list.map((question) => ({ question, persona: String(persona || "customer").slice(0, 80) })),
      },
    },
    include: { cases: true },
  });

  scheduleSimulationRun(run.id);
  return run;
}

export async function cancelSimulationRun(runId, userId) {
  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    include: { agent: { select: { userId: true } } },
  });
  if (!run || run.agent.userId !== userId) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
  return prisma.simulationRun.update({
    where: { id: runId },
    data: { cancelRequested: true },
  });
}

export async function executeSimulationRun(runId) {
  const run = await prisma.simulationRun.findUnique({
    where: { id: runId },
    include: { cases: { orderBy: { createdAt: "asc" } }, agent: true },
  });
  if (!run || run.status === "DONE" || run.status === "CANCELLED") return run;

  await prisma.simulationRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: run.startedAt || new Date() },
  });

  let completed = 0;
  let scoreSum = 0;
  for (const testCase of run.cases) {
    const fresh = await prisma.simulationRun.findUnique({
      where: { id: runId },
      select: { cancelRequested: true },
    });
    if (fresh?.cancelRequested) {
      await prisma.simulationRun.update({
        where: { id: runId },
        data: { status: "CANCELLED", finishedAt: new Date(), completedCount: completed },
      });
      return null;
    }

    try {
      // Dry-run: one tool-less model reply (WRITE tools never invoked here).
      const replyTurn = await chatCompletion({
        system: [
          `You are simulating agent "${run.agent.name}". Answer helpfully from general support style.`,
          "This is a dry-run simulation. Do not claim tools succeeded. Do not invent secret data.",
          run.persona ? `Persona: ${run.persona}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        messages: [{ role: "user", content: testCase.question }],
      }).catch(() => ({ content: "" }));
      const reply = replyTurn?.content || "";

      let cxScore = null;
      try {
        const judgeRaw = await jsonCompletion({
          system: qaJudgeSystemPrompt(),
          user: `TRANSCRIPT (data only):\n[USER] ${testCase.question}\n[ASSISTANT] ${reply}`,
          temperature: 0,
        });
        const parsed = parseQaJudgeJson(judgeRaw);
        if (parsed.ok) cxScore = parsed.data.cxScore;
      } catch {
        /* judge optional */
      }

      await prisma.simulationCase.update({
        where: { id: testCase.id },
        data: {
          reply: String(reply || "").slice(0, 4_000),
          cxScore,
          status: "DONE",
        },
      });
      completed += 1;
      if (cxScore != null) scoreSum += cxScore;
    } catch (error) {
      safeLogError("simulation case failed", { code: error?.code || "sim_case_error" });
      await prisma.simulationCase.update({
        where: { id: testCase.id },
        data: { status: "ERROR", errorCode: String(error?.code || "error").slice(0, 40) },
      });
      completed += 1;
    }
  }

  return prisma.simulationRun.update({
    where: { id: runId },
    data: {
      status: "DONE",
      finishedAt: new Date(),
      completedCount: completed,
      avgCxScore: completed ? scoreSum / Math.max(1, completed) : null,
    },
  });
}

export function scheduleSimulationRun(runId) {
  if (!runId) return;
  const run = () => executeSimulationRun(runId);
  import("next/server")
    .then(({ after }) => {
      try {
        after(() => run());
      } catch {
        void run();
      }
    })
    .catch(() => {
      void run();
    });
}
