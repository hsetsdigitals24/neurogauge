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
from app.core.plots import scatter_spec, heatmap_spec

router = APIRouter(tags=["correlation"], dependencies=[Depends(require_secret)])


@router.post("/correlation", response_model=AnalysisResponse)
def correlation(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    method = (req.options.get("method") or "pearson").lower()
    if method not in {"pearson", "spearman", "kendall"}:
        raise HTTPException(400, "options.method must be one of: pearson, spearman, kendall")
    alpha = float(req.options.get("alpha", 0.05))

    columns = req.variables.get("columns") or []
    if len(columns) < 2:
        raise HTTPException(400, "variables.columns must contain at least 2 columns")

    df = pd.DataFrame(req.data)
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise HTTPException(400, f"columns not found: {missing}")

    numeric = df[columns].apply(pd.to_numeric, errors="coerce")
    numeric = numeric.dropna()
    if len(numeric) < 3:
        raise HTTPException(400, f"need >= 3 complete observations, got {len(numeric)}")

    rows: list[dict[str, Any]] = []
    pair_stats: dict[str, dict[str, Any]] = {}
    plots: list[PlotSpec] = []

    for i, a in enumerate(columns):
        for b in columns[i + 1:]:
            res = pg.corr(numeric[a], numeric[b], method=method)
            row = res.iloc[0].to_dict()
            r = float(row["r"])
            p_key = "p_val" if "p_val" in row else "p-val"
            p = float(row[p_key])
            n = int(row["n"])
            ci_key = next((k for k in row if k.startswith("CI")), None)
            ci = row.get(ci_key) if ci_key else None
            ci_low = float(ci[0]) if ci is not None else None
            ci_high = float(ci[1]) if ci is not None else None
            key = f"{a} ↔ {b}"
            pair_stats[key] = {
                "r": round(r, 6), "p_value": round(p, 6), "n": n,
                "ci_low": round(ci_low, 6) if ci_low is not None else None,
                "ci_high": round(ci_high, 6) if ci_high is not None else None,
                "significant": bool(p < alpha),
            }
            rows.append({
                "x": a, "y": b, "method": method,
                "r": round(r, 4), "p_value": round(p, 6),
                "n": n,
                "ci_low": round(ci_low, 4) if ci_low is not None else None,
                "ci_high": round(ci_high, 4) if ci_high is not None else None,
                "significant": "yes" if p < alpha else "no",
            })
            # one scatter per pair
            plots.append(PlotSpec(
                type="scatter",
                plotly=scatter_spec(
                    numeric[a].tolist(), numeric[b].tolist(),
                    x_label=a, y_label=b,
                    title=f"{a} vs {b} (r={r:.3f}, p={p:.3g})",
                ),
            ))

    # heatmap if 3+ vars
    if len(columns) >= 3:
        matrix: list[list[float]] = []
        for a in columns:
            row: list[float] = []
            for b in columns:
                if a == b:
                    row.append(1.0)
                else:
                    res = pg.corr(numeric[a], numeric[b], method=method)
                    row.append(round(float(res["r"].iloc[0]), 3))
            matrix.append(row)  # noqa: PERF401
        plots.insert(0, PlotSpec(
            type="corr_heatmap",
            plotly=heatmap_spec(matrix, columns, columns,
                                title=f"{method.capitalize()} correlation matrix",
                                zmin=-1, zmax=1),
        ))

    table = df_to_table(pd.DataFrame(rows))
    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats={"method": method, "alpha": alpha, "pairs": pair_stats},
        table=TableBlock(**table), plots=plots, warnings=[],
        meta=Meta(n=int(len(numeric)), duration_ms=duration_ms, version=VERSION),
    )
