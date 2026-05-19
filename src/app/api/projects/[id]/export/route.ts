import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { summarize } from "@/lib/scoring";
import type { Trial } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function esc(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "long";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      ownerId: true,
      name: true,
      config: true,
      collaborators: { select: { userId: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = project.ownerId === user.userId;
  const isCollab = project.collaborators.some(
    (c: { userId: string }) => c.userId === user.userId
  );
  if (!isOwner && !isCollab) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await db.testSession.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    include: {
      blocks: {
        orderBy: { blockIndex: "asc" },
        include: { trials: { orderBy: { trialIndex: "asc" } } },
      },
    },
  });

  const customQuestionIds = Array.from(new Set(
    ((project.config as any)?.customQuestions ?? []).map((q: any) => q.id)
  ));

  const slug = (project.name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";

  let body: string;
  let filename: string;

  if (format === "wide") {
    const headers = [
      "session_id", "participant_id", "taker_email",
      "stimulus_type", "level", "scorable", "hits", "misses",
      "false_alarms", "correct_rejections", "accuracy", "hit_rate", "fa_rate",
      "d_prime", "criterion", "rt_mean_ms", "rt_median_ms", "rt_sd_ms",
      "level_mental", "level_physical", "level_temporal", "level_performance",
      "level_effort", "level_frustration", "level_paas",
      "global_mental", "global_physical", "global_temporal", "global_performance",
      "global_effort", "global_frustration", "global_paas",
      "taker_age", "taker_handedness", "taker_education",
      "started_at", "finished_at",
      ...customQuestionIds.map((id) => `custom_${id}`),
    ];
    const rows = [headers.join(",")];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of sessions as any[]) {
      const g = (s.globalTLX as Record<string, number> | null) ?? null;
      for (const b of s.blocks) {
        const tlx = (b.perLevelTLX as Record<string, number> | null) ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trials: Trial[] = b.trials.map((t: any) => ({
          trialIndex: t.trialIndex,
          stimulusType: b.stimulusType as Trial["stimulusType"],
          level: b.level as Trial["level"],
          stimulus: t.stimulus,
          isPriming: t.isPriming,
          expectedMatch: t.expectedMatch,
          responded: t.responded,
          responseYes: t.responseYes,
          rtMs: t.rtMs,
          correct: t.correct,
          onsetTs: t.onsetTs,
        }));
        const m = summarize(trials);
        const answers = (s.customAnswers as Record<string, string> | null) ?? {};
        rows.push([
          s.id, s.participantId, s.takerEmail,
          b.stimulusType, b.level,
          m.scorable, m.hits, m.misses, m.falseAlarms, m.correctRejections,
          m.accuracy.toFixed(4), m.hitRate.toFixed(4), m.faRate.toFixed(4),
          m.dPrime.toFixed(4), m.criterion.toFixed(4),
          m.rtMean?.toFixed(1) ?? "", m.rtMedian?.toFixed(1) ?? "", m.rtSD?.toFixed(1) ?? "",
          tlx?.mentalDemand ?? "", tlx?.physicalDemand ?? "", tlx?.temporalDemand ?? "",
          tlx?.performance ?? "", tlx?.effort ?? "", tlx?.frustration ?? "", tlx?.paasMentalEffort ?? "",
          g?.mentalDemand ?? "", g?.physicalDemand ?? "", g?.temporalDemand ?? "",
          g?.performance ?? "", g?.effort ?? "", g?.frustration ?? "", g?.paasMentalEffort ?? "",
          s.takerAge ?? "", s.takerHandedness ?? "", s.takerEducation ?? "",
          s.startedAt ? new Date(s.startedAt).toISOString() : "",
          s.finishedAt ? new Date(s.finishedAt).toISOString() : "",
          ...customQuestionIds.map((id) => answers[id] ?? ""),
        ].map(esc).join(","));
      }
    }
    body = rows.join("\n");
    filename = `${slug}_summary_wide.csv`;
  } else {
    const headers = [
      "session_id", "participant_id", "taker_email",
      "stimulus_type", "level", "trial_index",
      "is_priming", "stimulus", "expected_match", "responded", "response_yes",
      "correct", "rt_ms", "onset_ts",
      "level_mental", "level_physical", "level_temporal", "level_performance",
      "level_effort", "level_frustration", "level_paas",
      "global_mental", "global_physical", "global_temporal", "global_performance",
      "global_effort", "global_frustration", "global_paas",
      "taker_age", "taker_handedness", "taker_education",
      ...customQuestionIds.map((id) => `custom_${id}`),
    ];
    const rows = [headers.join(",")];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of sessions as any[]) {
      const g = (s.globalTLX as Record<string, number> | null) ?? null;
      const answers = (s.customAnswers as Record<string, string> | null) ?? {};
      for (const b of s.blocks) {
        const tlx = (b.perLevelTLX as Record<string, number> | null) ?? null;
        for (const t of b.trials) {
          rows.push([
            s.id, s.participantId, s.takerEmail,
            b.stimulusType, b.level, t.trialIndex,
            t.isPriming, t.stimulus, t.expectedMatch, t.responded, t.responseYes,
            t.correct, t.rtMs, t.onsetTs,
            tlx?.mentalDemand ?? "", tlx?.physicalDemand ?? "", tlx?.temporalDemand ?? "",
            tlx?.performance ?? "", tlx?.effort ?? "", tlx?.frustration ?? "", tlx?.paasMentalEffort ?? "",
            g?.mentalDemand ?? "", g?.physicalDemand ?? "", g?.temporalDemand ?? "",
            g?.performance ?? "", g?.effort ?? "", g?.frustration ?? "", g?.paasMentalEffort ?? "",
            s.takerAge ?? "", s.takerHandedness ?? "", s.takerEducation ?? "",
            ...customQuestionIds.map((id) => answers[id] ?? ""),
          ].map(esc).join(","));
        }
      }
    }
    body = rows.join("\n");
    filename = `${slug}_trials_long.csv`;
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
