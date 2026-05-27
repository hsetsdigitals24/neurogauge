import time
from typing import Any
import numpy as np
import pandas as pd
import pingouin as pg
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.plots import boxplot_spec

router = APIRouter(tags=["reliability"], dependencies=[Depends(require_secret)])


def _mcdonald_omega(items: pd.DataFrame) -> float | None:
    """McDonald's ω via single-factor loadings (factor analysis fallback to PCA).

    ω = (Σ λ)² / [(Σ λ)² + Σ (1 − λ²)]
    where λ are standardized loadings on a single common factor.
    """
    X = items.to_numpy(dtype=float)
    n, k = X.shape
    if n < 3 or k < 2:
        return None
    # Standardize
    mu = X.mean(axis=0)
    sd = X.std(axis=0, ddof=1)
    sd[sd == 0] = 1.0
    Z = (X - mu) / sd
    # Use the first principal component of the correlation matrix as the common factor.
    corr = np.corrcoef(Z, rowvar=False)
    if np.isnan(corr).any():
        return None
    eigvals, eigvecs = np.linalg.eigh(corr)
    idx = np.argsort(eigvals)[::-1]
    eigvals = eigvals[idx]
    eigvecs = eigvecs[:, idx]
    pc1 = eigvecs[:, 0]
    # Loadings = sqrt(eigvalue) * eigvector. Sign-flip so the majority is positive.
    loadings = np.sqrt(max(eigvals[0], 0.0)) * pc1
    if (loadings < 0).sum() > (loadings > 0).sum():
        loadings = -loadings
    sum_load = float(loadings.sum())
    sum_uniq = float(np.sum(1.0 - loadings**2))
    denom = sum_load**2 + sum_uniq
    if denom <= 0:
        return None
    return float(sum_load**2 / denom)


@router.post("/reliability", response_model=AnalysisResponse)
def reliability(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    items = req.variables.get("items") or []
    if len(items) < 2:
        raise HTTPException(400, "variables.items must list at least 2 columns")

    df = pd.DataFrame(req.data)
    missing = [c for c in items if c not in df.columns]
    if missing:
        raise HTTPException(400, f"columns not found: {missing}")

    numeric = df[items].apply(pd.to_numeric, errors="coerce").dropna()
    if len(numeric) < 3:
        raise HTTPException(400, f"need >= 3 complete rows, got {len(numeric)}")

    warnings: list[str] = []

    # Cronbach α via pingouin
    alpha_val, ci = pg.cronbach_alpha(data=numeric)
    cronbach_low, cronbach_high = float(ci[0]), float(ci[1])

    # McDonald's ω (own implementation — pingouin doesn't expose it directly)
    omega = _mcdonald_omega(numeric)

    # Per-item correlation with total - the classic "if item deleted" diagnostic.
    per_item: list[dict[str, Any]] = []
    total = numeric.sum(axis=1)
    for col in items:
        # corrected item-total: total minus this item
        rest = total - numeric[col]
        r = float(np.corrcoef(numeric[col], rest)[0, 1]) if rest.std() > 0 else float("nan")
        # alpha if deleted
        try:
            alpha_del, _ = pg.cronbach_alpha(data=numeric.drop(columns=[col]))
            alpha_del = float(alpha_del)
        except Exception:
            alpha_del = float("nan")
        per_item.append({
            "item": col,
            "mean": round(float(numeric[col].mean()), 4),
            "sd": round(float(numeric[col].std(ddof=1)), 4),
            "item_total_r": round(r, 4) if not np.isnan(r) else None,
            "alpha_if_deleted": round(alpha_del, 4) if not np.isnan(alpha_del) else None,
        })

    if alpha_val < 0.7:
        warnings.append(f"Cronbach α = {alpha_val:.3f} is below the conventional 0.70 acceptable threshold.")
    if omega is not None and omega < 0.7:
        warnings.append(f"McDonald ω = {omega:.3f} is below 0.70 — consider revising or dropping items.")

    stats_out = {
        "n": int(len(numeric)),
        "k_items": len(items),
        "cronbach_alpha": round(float(alpha_val), 6),
        "cronbach_alpha_ci_low": round(cronbach_low, 6),
        "cronbach_alpha_ci_high": round(cronbach_high, 6),
        "mcdonald_omega": round(omega, 6) if omega is not None else None,
        "per_item": per_item,
    }

    # Summary table = global metrics + per-item rows
    summary = pd.DataFrame([
        {"item": "(global)",
         "cronbach_alpha": stats_out["cronbach_alpha"],
         "alpha_ci_low": stats_out["cronbach_alpha_ci_low"],
         "alpha_ci_high": stats_out["cronbach_alpha_ci_high"],
         "mcdonald_omega": stats_out["mcdonald_omega"]},
    ])
    per_item_df = pd.DataFrame(per_item)
    table = df_to_table(pd.concat([summary, per_item_df], ignore_index=True))

    # Box plot per item — sanity check for variance and obvious outliers
    plots = [PlotSpec(
        type="boxplot",
        plotly=boxplot_spec(
            {c: numeric[c].tolist() for c in items},
            title="Item distributions",
            y_label="response",
        ),
    )]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(numeric)), duration_ms=duration_ms, version=VERSION),
    )
