import time
from typing import Any
import numpy as np
import pandas as pd
from scipy import stats
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.guards import compute_guard
from app.core.plots import scree_spec, heatmap_spec

router = APIRouter(tags=["factor"], dependencies=[Depends(require_secret)])

_ROTATIONS = {"varimax", "none"}


def _varimax(loadings: np.ndarray, max_iter: int = 100, tol: float = 1e-6) -> np.ndarray:
    """Kaiser varimax rotation of a (items x factors) loading matrix."""
    p, k = loadings.shape
    if k < 2:
        return loadings
    R = np.eye(k)
    d = 0.0
    for _ in range(max_iter):
        d_old = d
        L = loadings @ R
        diag = np.diag((L ** 2).sum(axis=0))
        u, s, vh = np.linalg.svd(loadings.T @ (L ** 3 - (L @ diag) / p))
        R = u @ vh
        d = float(s.sum())
        if d_old != 0 and d / d_old < 1 + tol:
            break
    return loadings @ R


def _kmo(R: np.ndarray) -> float | None:
    """Kaiser-Meyer-Olkin overall measure of sampling adequacy."""
    try:
        inv = np.linalg.inv(R)
    except np.linalg.LinAlgError:
        return None
    d = np.sqrt(np.outer(np.diag(inv), np.diag(inv)))
    partial = -inv / d  # partial correlations
    np.fill_diagonal(partial, 0.0)
    Rc = R.copy()
    np.fill_diagonal(Rc, 0.0)
    sum_r2 = float((Rc ** 2).sum())
    sum_p2 = float((partial ** 2).sum())
    denom = sum_r2 + sum_p2
    return sum_r2 / denom if denom > 0 else None


@router.post("/factor", response_model=AnalysisResponse)
def factor(req: AnalysisRequest) -> AnalysisResponse:
    """Exploratory factor analysis (PCA extraction): scree plot, KMO/Bartlett, loading heatmap."""
    started = time.perf_counter()

    items = req.variables.get("items") or []
    if not isinstance(items, list) or len(items) < 3:
        raise HTTPException(400, "variables.items must list at least 3 numeric columns")
    rotation = (req.options.get("rotation") or "varimax").lower()
    if rotation not in _ROTATIONS:
        raise HTTPException(400, f"options.rotation must be one of {sorted(_ROTATIONS)}")
    n_factors_opt = req.options.get("n_factors", "auto")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    missing = [c for c in items if c not in df.columns]
    if missing:
        raise HTTPException(400, f"items not found in data: {missing}")

    X = df[items].apply(pd.to_numeric, errors="coerce").dropna().to_numpy(dtype=float)
    n, p = X.shape
    if n < p + 1:
        raise HTTPException(400, f"need more complete rows than items ({p}); got {n}")

    warnings: list[str] = []

    # Correlation matrix and its eigen-decomposition.
    with compute_guard("Factor analysis"):
        R = np.corrcoef(X, rowvar=False)
        if not np.all(np.isfinite(R)):
            raise HTTPException(400, "correlation matrix is not finite — an item may be constant or all-missing")
        eigvals, eigvecs = np.linalg.eigh(R)
    order = np.argsort(eigvals)[::-1]
    eigvals = eigvals[order]
    eigvecs = eigvecs[:, order]
    eigenvalues = [float(v) for v in eigvals]

    # Bartlett's test of sphericity.
    det = float(np.linalg.det(R))
    if det > 0:
        chi2 = -((n - 1) - (2 * p + 5) / 6.0) * np.log(det)
        bart_df = p * (p - 1) / 2
        bart_p = float(stats.chi2.sf(chi2, bart_df))
        bart_chi2 = float(chi2)
    else:
        bart_chi2 = bart_p = None
        warnings.append("Correlation matrix is singular — Bartlett's test unavailable.")

    kmo_model = _kmo(R)
    if kmo_model is not None and kmo_model < 0.6:
        warnings.append(f"KMO = {kmo_model:.3f} (< 0.6) — sampling adequacy is poor for factor analysis.")

    # Resolve number of factors (Kaiser criterion when auto).
    if isinstance(n_factors_opt, str) and n_factors_opt.lower() == "auto":
        n_factors = max(1, int(sum(1 for v in eigenvalues if v > 1.0)))
    else:
        n_factors = int(n_factors_opt)
    n_factors = max(1, min(n_factors, p - 1))

    # Principal-component extraction: loadings = eigenvector * sqrt(eigenvalue).
    pos = np.clip(eigvals[:n_factors], 0, None)
    loadings = eigvecs[:, :n_factors] * np.sqrt(pos)
    if rotation == "varimax":
        loadings = _varimax(loadings)

    factor_names = [f"F{i + 1}" for i in range(n_factors)]
    loading_rows: list[dict[str, Any]] = []
    for i, item in enumerate(items):
        row: dict[str, Any] = {"item": item}
        for j, fn in enumerate(factor_names):
            row[fn] = round(float(loadings[i, j]), 4)
        loading_rows.append(row)

    ss = (loadings ** 2).sum(axis=0)
    cum = np.cumsum(ss) / p
    var_rows = [
        {"factor": fn, "ss_loadings": round(float(ss[j]), 4),
         "prop_var": round(float(ss[j] / p), 4), "cum_var": round(float(cum[j]), 4)}
        for j, fn in enumerate(factor_names)
    ]

    stats_out = {
        "model": "EFA",
        "n": int(n),
        "n_items": p,
        "n_factors": n_factors,
        "rotation": rotation,
        "kmo": round(float(kmo_model), 4) if kmo_model is not None else None,
        "bartlett_chi2": round(bart_chi2, 4) if bart_chi2 is not None else None,
        "bartlett_p": round(bart_p, 6) if bart_p is not None else None,
        "eigenvalues": [round(v, 4) for v in eigenvalues],
        "loadings": loading_rows,
        "variance_explained": var_rows,
    }

    table = df_to_table(pd.DataFrame(loading_rows))

    plots = [
        PlotSpec(type="scree", plotly=scree_spec(eigenvalues, title="Scree plot")),
        PlotSpec(
            type="factor_heatmap",
            plotly=heatmap_spec(
                loadings.tolist(), factor_names, list(items),
                title="Factor loadings", zmin=-1.0, zmax=1.0,
            ),
        ),
    ]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(n), duration_ms=duration_ms, version=VERSION),
    )
