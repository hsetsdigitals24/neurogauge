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

router = APIRouter(tags=["mann_whitney"], dependencies=[Depends(require_secret)])


@router.post("/mann-whitney", response_model=AnalysisResponse)
def mann_whitney(req: AnalysisRequest) -> AnalysisResponse:
    """Mann-Whitney U test — non-parametric alternative to the independent t-test."""
    started = time.perf_counter()

    column = req.variables.get("column")
    group_by = req.variables.get("group_by")
    alpha = float(req.options.get("alpha", 0.05))
    alternative = req.options.get("alternative", "two-sided")
    if alternative not in {"two-sided", "less", "greater"}:
        raise HTTPException(400, "options.alternative must be one of: two-sided, less, greater")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    if not column or column not in df.columns:
        raise HTTPException(400, "variables.column required and must exist")
    if not group_by or group_by not in df.columns:
        raise HTTPException(400, "variables.group_by required and must exist")

    groups = list(df.groupby(group_by, dropna=False))
    if len(groups) != 2:
        raise HTTPException(400, f"group_by must have exactly 2 levels, found {len(groups)}")
    (g1, d1), (g2, d2) = groups
    a = pd.to_numeric(d1[column], errors="coerce").dropna().to_numpy(dtype=float)
    b = pd.to_numeric(d2[column], errors="coerce").dropna().to_numpy(dtype=float)
    if a.size < 1 or b.size < 1:
        raise HTTPException(400, f"each group needs >= 1 observation (got {a.size} and {b.size})")

    warnings: list[str] = []
    with compute_guard("Mann-Whitney U"):
        out = pg.mwu(a, b, alternative=alternative)
    row = out.iloc[0].to_dict()
    p_val = float(row.get("p_val", row.get("p-val", float("nan"))))
    u_val = float(row.get("U_val", row.get("U-val", float("nan"))))
    title = f"Mann-Whitney U — {column} by {group_by}"

    stats_out = {
        "test": title,
        "u": round(u_val, 6),
        "p_value": round(p_val, 6),
        "alternative": alternative,
        "alpha": alpha,
        "significant": bool(p_val < alpha),
        "rank_biserial_r": round(float(row["RBC"]), 6) if "RBC" in row else None,
        "cles": round(float(row["CLES"]), 6) if "CLES" in row else None,
        "n1": int(a.size),
        "n2": int(b.size),
    }

    table_df = pd.DataFrame([{
        "test": title,
        "U": stats_out["u"],
        "p_value": stats_out["p_value"],
        "rank_biserial_r": stats_out["rank_biserial_r"],
        "n1": stats_out["n1"],
        "n2": stats_out["n2"],
        "significant": "yes" if stats_out["significant"] else "no",
    }])
    table = df_to_table(table_df)

    plots = [PlotSpec(
        type="boxplot",
        plotly=boxplot_spec({str(g1): a.tolist(), str(g2): b.tolist()},
                            title=f"{column} by {group_by}", y_label=column),
    )]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
