import { prisma } from "@/lib/prisma";
import { summarize } from "@/lib/scoring";
import type { Trial } from "@/lib/types";

function esc(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "long"; // "long" | "wide"

  const sessions = await prisma.session.findMany({
    include: { blocks: { include: { trials: true }, orderBy: { blockIndex: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const customQuestionIds = Array.from(new Set(
    sessions.flatMap((s) => ((s.config as any)?.customQuestions ?? []).map((q: any) => q.id))
  ));

  let body: string;
  let filename: string;

  if (format === "wide") {
    const headers = [
      "session_id","participant_id","stimulus_type","level","scorable","hits","misses",
      "false_alarms","correct_rejections","accuracy","hit_rate","fa_rate","d_prime",
      "criterion","rt_mean_ms","rt_median_ms","rt_sd_ms",
      "level_mental","level_physical","level_temporal","level_performance","level_effort",
      "level_frustration","level_paas",
      "global_mental","global_physical","global_temporal","global_performance",
      "global_effort","global_frustration","global_paas",
      "age","gender","handedness","education",
      ...customQuestionIds.map((id) => `custom_${id}`),
    ];
    const rows = [headers.join(",")];
    for (const s of sessions) {
      const g = (s.globalTLX as Record<string, number> | null) ?? null;
      const d = (s.demographics as Record<string, string> | null) ?? null;
      const answers = (s.customAnswers as Record<string, string> | null) ?? {};
      for (const b of s.blocks) {
        const tlx = (b.perLevelTLX as Record<string, number> | null) ?? null;
        const trials: Trial[] = b.trials.map((t) => ({
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
        rows.push([
          s.id, s.participantId, b.stimulusType, b.level,
          m.scorable, m.hits, m.misses, m.falseAlarms, m.correctRejections,
          m.accuracy.toFixed(4), m.hitRate.toFixed(4), m.faRate.toFixed(4),
          m.dPrime.toFixed(4), m.criterion.toFixed(4),
          m.rtMean?.toFixed(1) ?? "", m.rtMedian?.toFixed(1) ?? "", m.rtSD?.toFixed(1) ?? "",
          tlx?.mentalDemand ?? "", tlx?.physicalDemand ?? "", tlx?.temporalDemand ?? "",
          tlx?.performance ?? "", tlx?.effort ?? "", tlx?.frustration ?? "", tlx?.paasMentalEffort ?? "",
          g?.mentalDemand ?? "", g?.physicalDemand ?? "", g?.temporalDemand ?? "",
          g?.performance ?? "", g?.effort ?? "", g?.frustration ?? "", g?.paasMentalEffort ?? "",
          d?.age ?? "", d?.gender ?? "", d?.handedness ?? "", d?.education ?? "",
          ...customQuestionIds.map((id) => answers[id] ?? ""),
        ].map(esc).join(","));
      }
    }
    body = rows.join("\n");
    filename = "nback_summary_wide.csv";
  } else {
    const headers = [
      "session_id","participant_id","stimulus_type","level","trial_index",
      "is_priming","stimulus","expected_match","responded","response_yes","correct","rt_ms","onset_ts",
      "level_mental","level_physical","level_temporal","level_performance","level_effort",
      "level_frustration","level_paas",
      "global_mental","global_physical","global_temporal","global_performance",
      "global_effort","global_frustration","global_paas",
      "age","gender","handedness","education",
      ...customQuestionIds.map((id) => `custom_${id}`),
    ];
    const rows = [headers.join(",")];
    for (const s of sessions) {
      const g = (s.globalTLX as Record<string, number> | null) ?? null;
      const d = (s.demographics as Record<string, string> | null) ?? null;
      const answers = (s.customAnswers as Record<string, string> | null) ?? {};
      for (const b of s.blocks) {
        const tlx = (b.perLevelTLX as Record<string, number> | null) ?? null;
        for (const t of b.trials) {
          rows.push([
            s.id, s.participantId, b.stimulusType, b.level, t.trialIndex,
            t.isPriming, t.stimulus, t.expectedMatch, t.responded, t.responseYes,
            t.correct, t.rtMs, t.onsetTs,
            tlx?.mentalDemand ?? "", tlx?.physicalDemand ?? "", tlx?.temporalDemand ?? "",
            tlx?.performance ?? "", tlx?.effort ?? "", tlx?.frustration ?? "", tlx?.paasMentalEffort ?? "",
            g?.mentalDemand ?? "", g?.physicalDemand ?? "", g?.temporalDemand ?? "",
            g?.performance ?? "", g?.effort ?? "", g?.frustration ?? "", g?.paasMentalEffort ?? "",
            d?.age ?? "", d?.gender ?? "", d?.handedness ?? "", d?.education ?? "",
            ...customQuestionIds.map((id) => answers[id] ?? ""),
          ].map(esc).join(","));
        }
      }
    }
    body = rows.join("\n");
    filename = "nback_trials_long.csv";
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
