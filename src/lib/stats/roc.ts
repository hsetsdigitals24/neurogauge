export interface RocPoint { threshold: number; tpr: number; fpr: number; sensitivity: number; specificity: number; }

export interface RocResult {
  points: RocPoint[];
  auc: number;
  optimal: { threshold: number; sensitivity: number; specificity: number; youden: number };
  n: number;
  positives: number;
  negatives: number;
}

/**
 * Build ROC curve. labels are 0/1 (1 = positive class). scores higher = more positive.
 */
export function roc(labels: number[], scores: number[]): RocResult {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(labels.length, scores.length); i++) {
    if ((labels[i] === 0 || labels[i] === 1) && isFinite(scores[i])) {
      pairs.push([scores[i], labels[i]]);
    }
  }
  pairs.sort((a, b) => b[0] - a[0]);
  const P = pairs.filter((p) => p[1] === 1).length;
  const N = pairs.length - P;
  const points: RocPoint[] = [{ threshold: Infinity, tpr: 0, fpr: 0, sensitivity: 0, specificity: 1 }];
  let TP = 0, FP = 0;
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][1] === 1) TP++; else FP++;
    if (i + 1 < pairs.length && pairs[i + 1][0] === pairs[i][0]) continue;
    const tpr = P > 0 ? TP / P : 0;
    const fpr = N > 0 ? FP / N : 0;
    points.push({ threshold: pairs[i][0], tpr, fpr, sensitivity: tpr, specificity: 1 - fpr });
  }
  points.push({ threshold: -Infinity, tpr: 1, fpr: 1, sensitivity: 1, specificity: 0 });

  // AUC via trapezoidal
  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    auc += ((points[i].fpr - points[i - 1].fpr) * (points[i].tpr + points[i - 1].tpr)) / 2;
  }

  // Optimal by Youden's J (max sens + spec - 1)
  let best = points[0];
  let bestJ = -Infinity;
  for (const p of points) {
    const j = p.sensitivity + p.specificity - 1;
    if (j > bestJ) { bestJ = j; best = p; }
  }

  return {
    points, auc, n: pairs.length, positives: P, negatives: N,
    optimal: { threshold: best.threshold, sensitivity: best.sensitivity, specificity: best.specificity, youden: bestJ },
  };
}
