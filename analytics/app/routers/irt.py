import time
from typing import Any
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.guards import compute_guard
from app.core.plots import icc_spec

router = APIRouter(tags=["irt"], dependencies=[Depends(require_secret)])


@router.post("/irt", response_model=AnalysisResponse)
def irt(req: AnalysisRequest) -> AnalysisResponse:
    """Item Response Theory (1PL/2PL): item parameters + item characteristic curves."""
    started = time.perf_counter()

    items = req.variables.get("items") or []
    if not isinstance(items, list) or len(items) < 2:
        raise HTTPException(400, "variables.items must list at least 2 binary item columns")
    model = (req.options.get("model") or "2pl").lower()
    if model not in {"1pl", "2pl"}:
        raise HTTPException(400, "options.model must be '1pl' or '2pl'")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    missing = [c for c in items if c not in df.columns]
    if missing:
        raise HTTPException(400, f"items not found in data: {missing}")

    X = df[items].apply(pd.to_numeric, errors="coerce").dropna()
    if len(X) < 10:
        raise HTTPException(400, f"need at least 10 complete respondents, got {len(X)}")

    warnings: list[str] = []
    # Ensure 0/1 coding; binarise at the item median if responses are not already binary.
    mat = X.to_numpy(dtype=float)
    uniq = np.unique(mat)
    if not np.all(np.isin(uniq, [0.0, 1.0])):
        warnings.append("Items were not 0/1 coded — binarised at each item's median.")
        med = np.median(mat, axis=0)
        mat = (mat > med).astype(float)

    # girth expects an (items x participants) matrix.
    data = mat.T.astype(int)

    try:
        from girth import twopl_mml, rasch_mml
    except Exception as exc:  # pragma: no cover
        raise HTTPException(501, f"IRT library not available: {exc}")

    # The whole fit is wrapped so that if estimation (including the Rasch fallback) fails on
    # degenerate input it surfaces as a clean 400 rather than an unhandled 500.
    with compute_guard("IRT estimation"):
        try:
            if model == "2pl":
                est = twopl_mml(data)
                discrimination = np.asarray(est["Discrimination"], dtype=float)
                difficulty = np.asarray(est["Difficulty"], dtype=float)
            else:
                est = rasch_mml(data)
                difficulty = np.asarray(est["Difficulty"], dtype=float)
                disc_val = float(np.asarray(est["Discrimination"]).ravel()[0])
                discrimination = np.full(len(items), disc_val, dtype=float)
        except Exception as exc:
            # Fall back to the Rasch model if 2PL estimation fails to converge.
            warnings.append(f"{model.upper()} estimation failed ({exc}); fell back to Rasch (1PL).")
            est = rasch_mml(data)
            difficulty = np.asarray(est["Difficulty"], dtype=float)
            disc_val = float(np.asarray(est["Discrimination"]).ravel()[0])
            discrimination = np.full(len(items), disc_val, dtype=float)
            model = "1pl"

    item_rows: list[dict[str, Any]] = []
    for i, name in enumerate(items):
        item_rows.append({
            "item": name,
            "discrimination_a": round(float(discrimination[i]), 4),
            "difficulty_b": round(float(difficulty[i]), 4),
        })

    # Item characteristic curves over the ability grid.
    theta = np.linspace(-4, 4, 81)
    curves: dict[str, list[float]] = {}
    for i, name in enumerate(items):
        a, b = float(discrimination[i]), float(difficulty[i])
        p = 1.0 / (1.0 + np.exp(-a * (theta - b)))
        curves[name] = [round(float(v), 5) for v in p]

    stats_out = {
        "model": model.upper(),
        "n": int(len(X)),
        "n_items": len(items),
        "items": item_rows,
    }

    table = df_to_table(pd.DataFrame(item_rows))

    plots = [PlotSpec(
        type="icc",
        plotly=icc_spec(theta.tolist(), curves, title=f"Item characteristic curves ({model.upper()})"),
    )]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(X)), duration_ms=duration_ms, version=VERSION),
    )
