import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import type { Session as ClientSession } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as ClientSession & { clientSubmissionId?: string };
  if (!body || !body.participantId || !Array.isArray(body.blocks)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const clientSubmissionId = body.clientSubmissionId;
  if (clientSubmissionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).session.findUnique({
      where: { clientSubmissionId },
      select: { id: true, participantId: true, createdAt: true },
    });
    if (existing) return NextResponse.json(existing, { status: 200 });
  }

  let created;
  try {
    created = await prisma.session.create({
    data: {
      participantId: body.participantId,
      startedAt: new Date(body.startedAt),
      finishedAt: body.finishedAt ? new Date(body.finishedAt) : null,
      config: body.config as object,
      consentGiven: body.consent?.consented ?? false,
      consentTs: body.consent?.ts ? new Date(body.consent.ts) : null,
      demographics: (body.demographics as object) ?? undefined,
      globalTLX: (body.globalTLX as object) ?? undefined,
      customAnswers: (body.customAnswers as object) ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(clientSubmissionId ? { clientSubmissionId } : {}) as any,
      blocks: {
        create: body.blocks.map((b, i) => ({
          blockIndex: i,
          stimulusType: b.stimulusType,
          level: b.level,
          perLevelTLX: (b.perLevelTLX as object) ?? undefined,
          trials: {
            create: b.trials.map((t) => ({
              trialIndex: t.trialIndex,
              stimulus: t.stimulus,
              isPriming: t.isPriming,
              expectedMatch: t.expectedMatch ?? null,
              responded: t.responded,
              responseYes: t.responseYes ?? null,
              rtMs: t.rtMs ?? null,
              correct: t.correct ?? null,
              onsetTs: t.onsetTs,
            })),
          },
        })),
      },
    },
    select: { id: true, participantId: true, createdAt: true },
  });
  } catch (e: unknown) {
    if (clientSubmissionId && (e as { code?: string })?.code === "P2002") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (prisma as any).session.findUnique({
        where: { clientSubmissionId },
        select: { id: true, participantId: true, createdAt: true },
      });
      if (existing) return NextResponse.json(existing, { status: 200 });
    }
    throw e;
  }

  return NextResponse.json(created, { status: 201 });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, participantId: true, startedAt: true, finishedAt: true,
      consentGiven: true, createdAt: true,
      _count: { select: { blocks: true } },
    },
  });
  return NextResponse.json(rows);
}
