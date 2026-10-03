import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { createSimulationRun } from "@/lib/services/simulation.service";
import prisma from "@/lib/prisma";
import { getAgentForUser } from "@/lib/services/agent.service";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id } = await params;
    await getAgentForUser(id, authResult.user.id);
    const runs = await prisma.simulationRun.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { cases: { select: { id: true, status: true, cxScore: true } } },
    });
    return NextResponse.json({ runs }, { status: 200 });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to list simulations", details: {} } },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: { message: "Invalid JSON", details: {} } }, { status: 400 });
    }
    const questions = String(body?.questionsText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const run = await createSimulationRun({
      agentId: id,
      userId: authResult.user.id,
      questions: body?.questions || questions,
      persona: body?.persona,
      revisionVersion: body?.revisionVersion ?? null,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to start simulation", details: {} } },
      { status: status === 400 || status === 403 || status === 404 || status === 429 ? status : 500 }
    );
  }
}
