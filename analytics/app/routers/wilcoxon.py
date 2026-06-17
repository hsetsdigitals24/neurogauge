import time
import pandas as pd
import pingouin as pg
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.guards import compute_guard
from app.core.plots import boxplot_spec

router = APIRouter(tags=["wilcoxon"], dependencies=[Depends(require_secret)])


@router.post("/wilcoxon", response_model=AnalysisResponse)
def wilcoxon(req: AnalysisRequest) -> AnalysisResponse:
    """Wilcoxon signed-rank test — non-parametric alternative to the paired t-test."""
    started = time.perf_counter()

    col_a = req.variables.get("column_a")
    col_b = req.variables.get("column_b")
    alpha = float(req.options.get("alpha", 0.05))
    alternative = req.options.get("alternative", "two-sided")
    if alternative not in {"two-sided", "less", "greater"}:
        raise HTTPException(400, "options.alternative must be one of: two-sided, less, greater")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    if not col_a or not col_b or col_a not in df.columns or col_b not in df.columns:
        raise HTTPException(400, "variables.column_a and column_b required and must exist")

    pair = df[[col_a, col_b]].apply(pd.to_numeric, errors="coerce").dropna()
    if len(pair) < 1:
        raise HTTPException(400, "need at least 1 complete paired observation")
    a = pair[col_a].to_numpy(dtype=float)
    b = pair[col_b].to_numpy(dtype=float)

    warnings: list[str] = []
    with compute_guard("Wilcoxon signed-rank"):
        out = pg.wilcoxon(a, b, alternative=alternative)
    row = out.iloc[0].to_dict()
    p_val = float(row.get("p_val", row.get("p-val", float("nan"))))
    w_val = float(row.get("W_val", row.get("W-val", float("nan"))))
    title = f"Wilcoxon signed-rank — {col_a} vs {col_b}"

    stats_out = {
        "test": title,
        "w": round(w_val, 6),
        "p_value": round(p_val, 6),
        "alternative": alternative,
        "alpha": alpha,
        "significant": bool(p_val < alpha),
        "rank_biserial_r": round(float(row["RBC"]), 6) if "RBC" in row else None,
        "cles": round(float(row["CLES"]), 6) if "CLES" in row else None,
        "n_pairs": int(len(pair)),
    }

    table_df = pd.DataFrame([{
        "test": title,
        "W": stats_out["w"],
        "p_value": stats_out["p_value"],
        "rank_biserial_r": stats_out["rank_biserial_r"],
        "n_pairs": stats_out["n_pairs"],
        "significant": "yes" if stats_out["significant"] else "no",
    }])
    table = df_to_table(table_df)

    plots = [PlotSpec(
        type="boxplot",
        plotly=boxplot_spec({col_a: a.tolist(), col_b: b.tolist()},
                            title=f"Paired distributions — {col_a} vs {col_b}", y_label="value"),
    )]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
