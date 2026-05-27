import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ shareToken: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { shareToken } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { shareToken },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const {
    participantId,
    takerEmail,
    takerAge,
    takerHandedness,
    takerEducation,
    startedAt,
    finishedAt,
    consentGiven,
    demographics,
    globalTLX,
    customAnswers,
    blocks,
    clientSubmissionId,
  } = body;

  if (!takerEmail || !takerAge || !takerHandedness || !takerEducation) {
    return NextResponse.json({ error: "Missing required taker info" }, { status: 400 });
  }

  if (clientSubmissionId) {
    const existing = await db.testSession.findUnique({
      where: { clientSubmissionId },
      select: { id: true, participantId: true, createdAt: true },
    });
    if (existing) return NextResponse.json(existing, { status: 200 });
  }

  let session;
  try {
    session = await db.testSession.create({
    data: {
      projectId: project.id,
      participantId,
      takerEmail: takerEmail.toLowerCase().trim(),
      takerAge,
      takerHandedness,
      takerEducation,
      startedAt: new Date(startedAt),
      finishedAt: finishedAt ? new Date(finishedAt) : null,
      consentGiven: consentGiven ?? false,
      demographics: demographics ?? undefined,
      globalTLX: globalTLX ?? undefined,
      customAnswers: customAnswers ?? undefined,
      clientSubmissionId: clientSubmissionId ?? undefined,
      blocks: {
        create: (blocks ?? []).map((b: {
          stimulusType: string; level: number; perLevelTLX?: object;
          trials: { trialIndex: number; stimulus: string; isPriming: boolean;
            expectedMatch: boolean | null; responded: boolean; responseYes: boolean | null;
            rtMs: number | null; correct: boolean | null; onsetTs: number; }[];
        }, i: number) => ({
          blockIndex: i,
          stimulusType: b.stimulusType,
          level: b.level,
          perLevelTLX: b.perLevelTLX ?? undefined,
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
      const existing = await db.testSession.findUnique({
        where: { clientSubmissionId },
        select: { id: true, participantId: true, createdAt: true },
      });
      if (existing) return NextResponse.json(existing, { status: 200 });
    }
    throw e;
  }

  // Invalidate analytics cache for this project — new data changes results.
  await db.analysisResult.deleteMany({ where: { projectId: project.id } }).catch(() => {});

  return NextResponse.json(session, { status: 201 });
}
