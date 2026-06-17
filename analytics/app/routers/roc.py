import time
from typing import Any
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve, roc_auc_score
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.guards import compute_guard
from app.core.plots import roc_curve_spec, confusion_matrix_spec

router = APIRouter(tags=["roc"], dependencies=[Depends(require_secret)])


def _bootstrap_auc_ci(y: np.ndarray, scores: np.ndarray, n_boot: int, alpha: float, seed: int = 7) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    n = y.size
    boots: list[float] = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, size=n)
        if len(np.unique(y[idx])) < 2:
            continue
        boots.append(float(roc_auc_score(y[idx], scores[idx])))
    if not boots:
        return float("nan"), float("nan")
    lo = float(np.percentile(boots, 100 * (alpha / 2)))
    hi = float(np.percentile(boots, 100 * (1 - alpha / 2)))
    return lo, hi


@router.post("/roc", response_model=AnalysisResponse)
def roc(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    truth_col = req.variables.get("truth")
    score_col = req.variables.get("score")
    positive_label = req.variables.get("positive_label")
    alpha = float(req.options.get("alpha", 0.05))
    n_boot = int(req.options.get("n_bootstrap", 1000))
    thresholds = req.options.get("thresholds")  # optional list of specific thresholds to report

    if not truth_col or not score_col:
        raise HTTPException(400, "variables.truth and variables.score required")

    df = pd.DataFrame(req.data)
    for c in (truth_col, score_col):
        if c not in df.columns:
            raise HTTPException(400, f"column '{c}' not found")

    sub = df[[truth_col, score_col]].copy()
    sub[score_col] = pd.to_numeric(sub[score_col], errors="coerce")
    sub = sub.dropna()
    if len(sub) < 5:
        raise HTTPException(400, f"need >= 5 complete rows, got {len(sub)}")

    raw_y = sub[truth_col]
    if pd.api.types.is_bool_dtype(raw_y):
        y = raw_y.astype(int).to_numpy()
        positive_label = "True"
    elif pd.api.types.is_numeric_dtype(raw_y):
        uniq = sorted({float(v) for v in raw_y.unique()})
        if uniq == [0.0, 1.0]:
            y = raw_y.astype(int).to_numpy()
            positive_label = "1"
        else:
            raise HTTPException(400, f"numeric truth must be 0/1, got {uniq}")
    else:
        levels = sorted(raw_y.astype(str).unique().tolist())
        if len(levels) != 2:
            raise HTTPException(400, f"truth must be binary, found {len(levels)} levels: {levels}")
        pos = positive_label if positive_label in levels else levels[-1]
        y = (raw_y.astype(str) == pos).astype(int).to_numpy()
        positive_label = pos

    scores = sub[score_col].to_numpy(dtype=float)
    if y.sum() == 0 or y.sum() == len(y):
        raise HTTPException(400, "ROC requires both positive and negative cases in the truth column")

    with compute_guard("ROC"):
        fpr, tpr, thr = roc_curve(y, scores)
        auc = float(roc_auc_score(y, scores))
        ci_lo, ci_hi = _bootstrap_auc_ci(y, scores, n_boot=n_boot, alpha=alpha)

    # Youden's J = sensitivity + specificity − 1 = tpr − fpr ; argmax gives optimal threshold.
    j = tpr - fpr
    best_idx = int(np.argmax(j))
    best_threshold = float(thr[best_idx])
    best_sens = float(tpr[best_idx])
    best_spec = float(1 - fpr[best_idx])

    rows: list[dict[str, Any]] = [{
        "threshold": "optimal (Youden's J)",
        "value": round(best_threshold, 6),
        "sensitivity": round(best_sens, 4),
        "specificity": round(best_spec, 4),
        "youden_j": round(best_sens + best_spec - 1, 4),
    }]

    # User-requested fixed thresholds
    if isinstance(thresholds, list):
        for t in thresholds:
            try:
                t_val = float(t)
            except Exception:
                continue
            pred = (scores >= t_val).astype(int)
            tp = int(((pred == 1) & (y == 1)).sum())
            tn = int(((pred == 0) & (y == 0)).sum())
            fp = int(((pred == 1) & (y == 0)).sum())
            fn = int(((pred == 0) & (y == 1)).sum())
            sens = tp / max(1, tp + fn)
            spec = tn / max(1, tn + fp)
            rows.append({
                "threshold": f"fixed {t_val:g}",
                "value": t_val,
                "sensitivity": round(sens, 4),
                "specificity": round(spec, 4),
                "youden_j": round(sens + spec - 1, 4),
            })

    stats_out = {
        "truth": truth_col,
        "score": score_col,
        "positive_label": positive_label,
        "n": int(len(sub)),
        "n_positive": int(y.sum()),
        "n_negative": int(len(y) - y.sum()),
        "auc": round(auc, 6),
        "auc_ci_low": round(ci_lo, 6) if not np.isnan(ci_lo) else None,
        "auc_ci_high": round(ci_hi, 6) if not np.isnan(ci_hi) else None,
        "n_bootstrap": n_boot,
        "alpha": alpha,
        "optimal_threshold": round(best_threshold, 6),
        "optimal_sensitivity": round(best_sens, 6),
        "optimal_specificity": round(best_spec, 6),
        "thresholds": rows,
    }

    table = df_to_table(pd.DataFrame(rows))

    # Confusion matrix at the optimal (Youden's J) threshold.
    opt_pred = (scores >= best_threshold).astype(int)
    opt_tp = int(((opt_pred == 1) & (y == 1)).sum())
    opt_tn = int(((opt_pred == 0) & (y == 0)).sum())
    opt_fp = int(((opt_pred == 1) & (y == 0)).sum())
    opt_fn = int(((opt_pred == 0) & (y == 1)).sum())

    plots = [
        PlotSpec(
            type="roc",
            plotly=roc_curve_spec(fpr.tolist(), tpr.tolist(), auc,
                                  title=f"ROC — {score_col} vs {truth_col} (AUC={auc:.3f})"),
        ),
        PlotSpec(
            type="confusion_matrix",
            plotly=confusion_matrix_spec(opt_tp, opt_tn, opt_fp, opt_fn,
                                         title=f"Confusion matrix (optimal threshold = {best_threshold:.3g})"),
        ),
    ]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=[],
        meta=Meta(n=int(len(sub)), duration_ms=duration_ms, version=VERSION),
    )
