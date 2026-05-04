import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Session as ClientSession } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as ClientSession;
  if (!body || !body.participantId || !Array.isArray(body.blocks)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const created = await prisma.session.create({
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

  return NextResponse.json(created, { status: 201 });
}

export async function GET() {
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
