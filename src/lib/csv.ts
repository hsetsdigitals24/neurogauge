import { Session } from "./types";
import { summarize } from "./scoring";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function trialsLongCsv(sess: Session): string {
  const headers = [
    "participant_id","study","timing_mode","stimulus_type","level","trial_index",
    "is_priming","stimulus","expected_match","responded","response_yes","correct","rt_ms","onset_ts"
  ];
  const rows: string[] = [headers.join(",")];
  for (const b of sess.blocks) {
    for (const t of b.trials) {
      rows.push([
        sess.participantId, sess.config.studyName, sess.config.timingMode,
        b.stimulusType, b.level, t.trialIndex, t.isPriming, t.stimulus,
        t.expectedMatch, t.responded, t.responseYes, t.correct, t.rtMs, t.onsetTs,
      ].map(csvEscape).join(","));
    }
  }
  return rows.join("\n");
}

export function summaryWideCsv(sess: Session): string {
  const headers = [
    "participant_id","stimulus_type","level","scorable","hits","misses","false_alarms",
    "correct_rejections","accuracy","hit_rate","fa_rate","d_prime","criterion",
    "rt_mean_ms","rt_median_ms","rt_sd_ms","mental_demand","physical_demand",
    "temporal_demand","performance","effort","frustration","paas_mental_effort",
    "global_mental","global_physical","global_temporal","global_performance",
    "global_effort","global_frustration","global_paas",
    "age","gender","handedness","education"
  ];
  const rows = [headers.join(",")];
  const g = sess.globalTLX;
  const d = sess.demographics ?? {};
  for (const b of sess.blocks) {
    const m = summarize(b.trials);
    const t = b.perLevelTLX;
    rows.push([
      sess.participantId, b.stimulusType, b.level,
      m.scorable, m.hits, m.misses, m.falseAlarms, m.correctRejections,
      m.accuracy.toFixed(4), m.hitRate.toFixed(4), m.faRate.toFixed(4),
      m.dPrime.toFixed(4), m.criterion.toFixed(4),
      m.rtMean?.toFixed(1) ?? "", m.rtMedian?.toFixed(1) ?? "", m.rtSD?.toFixed(1) ?? "",
      t?.mentalDemand ?? "", t?.physicalDemand ?? "", t?.temporalDemand ?? "",
      t?.performance ?? "", t?.effort ?? "", t?.frustration ?? "", t?.paasMentalEffort ?? "",
      g?.mentalDemand ?? "", g?.physicalDemand ?? "", g?.temporalDemand ?? "",
      g?.performance ?? "", g?.effort ?? "", g?.frustration ?? "", g?.paasMentalEffort ?? "",
      d.age ?? "", d.gender ?? "", d.handedness ?? "", d.education ?? "",
    ].map(csvEscape).join(","));
  }
  return rows.join("\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
