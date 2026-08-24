import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isQuestionnaireConfig } from "@/lib/types";

type Ctx = { params: Promise<{ shareToken: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { shareToken } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { shareToken },
    select: { id: true, config: true, ownerId: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json();
  const isQuestionnaire = isQuestionnaireConfig(project.config);
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
    answers,
    blocks,
    clientSubmissionId,
    siteCode,
  } = body;

  // Multicenter tagging: a per-site collection link carries a `siteCode` we resolve
  // to one of the project owner's Sites. Unknown/absent codes leave the session
  // untagged rather than failing the submission.
  let siteId: string | null = null;
  if (siteCode) {
    const site = await db.site.findUnique({
      where: { userId_code: { userId: project.ownerId, code: String(siteCode).toLowerCase().trim() } },
      select: { id: true },
    });
    siteId = site?.id ?? null;
  }

  // Questionnaire projects collect consent + email only; N-back needs the full
  // taker profile. Answers land in customAnswers either way.
  if (isQuestionnaire) {
    if (!takerEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
  } else if (!takerEmail || !takerAge || !takerHandedness || !takerEducation) {
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
      siteId: siteId ?? undefined,
      participantId,
      takerEmail: takerEmail.toLowerCase().trim(),
      // TestSession requires these non-null; questionnaires don't collect them.
      takerAge: takerAge ?? "",
      takerHandedness: takerHandedness ?? "",
      takerEducation: takerEducation ?? "",
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      finishedAt: finishedAt ? new Date(finishedAt) : null,
      consentGiven: consentGiven ?? false,
      demographics: demographics ?? undefined,
      globalTLX: globalTLX ?? undefined,
      customAnswers: (isQuestionnaire ? answers : customAnswers) ?? undefined,
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
