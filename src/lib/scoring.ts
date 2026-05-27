import { BlockResult, Trial } from "./types";

export interface BlockMetrics {
  scorable: number;
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  accuracy: number;
  hitRate: number;
  faRate: number;
  dPrime: number;
  criterion: number;
  rtMean: number | null;
  rtMedian: number | null;
  rtSD: number | null;
}

function z(p: number): number {
  // clamp to avoid infinities
  const clamped = Math.min(Math.max(p, 0.01), 0.99);
  // Acklam's approximation
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425, pu = 1 - pl;
  let q: number, r: number;
  if (clamped < pl) { q = Math.sqrt(-2 * Math.log(clamped)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (clamped <= pu) { q = clamped - 0.5; r = q*q; return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  q = Math.sqrt(-2 * Math.log(1 - clamped));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

export function summarize(trials: Trial[]): BlockMetrics {
  const scorable = trials.filter(t => !t.isPriming);
  let hits = 0, misses = 0, fa = 0, cr = 0;
  const rts: number[] = [];
  for (const t of scorable) {
    if (t.expectedMatch) {
      if (t.responseYes) { hits++; if (t.rtMs != null) rts.push(t.rtMs); }
      else misses++;
    } else {
      if (t.responseYes) fa++;
      else cr++;
    }
  }
  const targets = hits + misses;
  const nontargets = fa + cr;
  const hitRate = targets ? hits / targets : 0;
  const faRate = nontargets ? fa / nontargets : 0;
  const dPrime = z(hitRate) - z(faRate);
  const criterion = -0.5 * (z(hitRate) + z(faRate));
  const rtMean = rts.length ? rts.reduce((a,b)=>a+b,0) / rts.length : null;
  const sorted = [...rts].sort((a,b)=>a-b);
  const rtMedian = sorted.length ? sorted[Math.floor(sorted.length/2)] : null;
  const rtSD = rts.length > 1
    ? Math.sqrt(rts.reduce((s,v)=>s+(v-(rtMean as number))**2,0)/(rts.length-1))
    : null;
  return {
    scorable: scorable.length, hits, misses, falseAlarms: fa, correctRejections: cr,
    accuracy: scorable.length ? (hits + cr) / scorable.length : 0,
    hitRate, faRate, dPrime, criterion, rtMean, rtMedian, rtSD,
  };
}

export function summarizeBlocks(blocks: BlockResult[]) {
  return blocks.map(b => ({
    stimulusType: b.stimulusType,
    level: b.level,
    metrics: summarize(b.trials),
    tlx: b.perLevelTLX,
  }));
}
