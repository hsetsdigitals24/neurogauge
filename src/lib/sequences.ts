import { LETTERS, Level, StimulusType, StudyConfig } from "./types";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pool(type: StimulusType, cfg: StudyConfig): string[] {
  if (type === "letters") return LETTERS;
  if (type === "shapes") return cfg.shapes;
  // rotated-e: pool is rotation angles as strings
  return cfg.rotations.map((d) => String(d));
}

export interface GeneratedTrial {
  stimulus: string;
  isPriming: boolean;
  expectedMatch: boolean | null;
}

export function generateSequence(
  type: StimulusType,
  level: Level,
  cfg: StudyConfig,
  seed: number,
): GeneratedTrial[] {
  const r = rng(seed);
  const items = pool(type, cfg);
  const total = cfg.trialsPerBlock + (level === 0 ? 0 : level);
  const out: GeneratedTrial[] = [];

  // 0-back: target is a fixed letter (or first item for non-letter pools)
  const zeroTarget =
    type === "letters" ? cfg.zeroBackTarget : items[0];

  for (let i = 0; i < total; i++) {
    if (level !== 0 && i < level) {
      out.push({ stimulus: items[Math.floor(r() * items.length)], isPriming: true, expectedMatch: null });
      continue;
    }
    let stim: string;
    let expectedMatch: boolean;
    if (level === 0) {
      // 30% target
      expectedMatch = r() < cfg.targetRate;
      if (expectedMatch) stim = zeroTarget;
      else {
        do { stim = items[Math.floor(r() * items.length)]; } while (stim === zeroTarget);
      }
    } else {
      expectedMatch = r() < cfg.targetRate;
      if (expectedMatch) {
        stim = out[i - level].stimulus;
      } else {
        const back = out[i - level].stimulus;
        do { stim = items[Math.floor(r() * items.length)]; } while (stim === back);
      }
    }
    out.push({ stimulus: stim, isPriming: false, expectedMatch });
  }
  return out;
}

export function blockPlan(cfg: StudyConfig): { type: StimulusType; level: Level }[] {
  const plan: { type: StimulusType; level: Level }[] = [];
  for (const t of cfg.stimulusTypes) {
    for (const l of cfg.levels) plan.push({ type: t, level: l });
  }
  return plan;
}
