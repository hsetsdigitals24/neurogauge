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
from app.core.guards import compute_guard
from app.core.plots import boxplot_spec

router = APIRouter(tags=["ttest"], dependencies=[Depends(require_secret)])


@router.post("/ttest", response_model=AnalysisResponse)
def ttest(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    kind = (req.variables.get("kind") or "independent").lower()
    if kind not in {"independent", "paired", "one_sample"}:
        raise HTTPException(400, "variables.kind must be one of: independent, paired, one_sample")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")

    alpha = float(req.options.get("alpha", 0.05))
    alternative = req.options.get("alternative", "two-sided")
    if alternative not in {"two-sided", "less", "greater"}:
        raise HTTPException(400, "options.alternative must be one of: two-sided, less, greater")

    warnings: list[str] = []
    plots: list[PlotSpec] = []

    if kind == "one_sample":
        column = req.variables.get("column")
        mu = float(req.variables.get("mu", 0))
        if not column or column not in df.columns:
            raise HTTPException(400, "variables.column required and must exist")
        arr = pd.to_numeric(df[column], errors="coerce").dropna().to_numpy(dtype=float)
        if arr.size < 2:
            raise HTTPException(400, f"n={arr.size} — need at least 2 observations")
        with compute_guard("One-sample t-test"):
            out = pg.ttest(arr, mu, alternative=alternative, confidence=1 - alpha)
        title = f"One-sample t-test — {column} vs μ={mu}"
        plots.append(PlotSpec(
            type="boxplot",
            plotly=boxplot_spec({column: arr.tolist()}, title=f"Distribution — {column}", y_label=column),
        ))

    elif kind == "paired":
        col_a = req.variables.get("column_a")
        col_b = req.variables.get("column_b")
        if not col_a or not col_b or col_a not in df.columns or col_b not in df.columns:
            raise HTTPException(400, "variables.column_a and column_b required and must exist")
        pair = df[[col_a, col_b]].apply(pd.to_numeric, errors="coerce").dropna()
        if len(pair) < 2:
            raise HTTPException(400, f"n={len(pair)} — need at least 2 paired observations")
        with compute_guard("Paired t-test"):
            out = pg.ttest(pair[col_a].to_numpy(), pair[col_b].to_numpy(),
                           paired=True, alternative=alternative, confidence=1 - alpha)
        title = f"Paired t-test — {col_a} vs {col_b}"
        plots.append(PlotSpec(
            type="boxplot",
            plotly=boxplot_spec(
                {col_a: pair[col_a].tolist(), col_b: pair[col_b].tolist()},
                title=f"Paired distributions — {col_a} vs {col_b}", y_label="value",
            ),
        ))

    else:  # independent
        column = req.variables.get("column")
        group_by = req.variables.get("group_by")
        if not column or column not in df.columns:
            raise HTTPException(400, "variables.column required and must exist")
        if not group_by or group_by not in df.columns:
            raise HTTPException(400, "variables.group_by required and must exist for independent t-test")
        groups = list(df.groupby(group_by, dropna=False))
        if len(groups) != 2:
            raise HTTPException(400, f"group_by must have exactly 2 levels, found {len(groups)}")
        (g1, d1), (g2, d2) = groups
        a = pd.to_numeric(d1[column], errors="coerce").dropna().to_numpy(dtype=float)
        b = pd.to_numeric(d2[column], errors="coerce").dropna().to_numpy(dtype=float)
        if a.size < 2 or b.size < 2:
            raise HTTPException(400, f"each group needs >= 2 observations (got {a.size} and {b.size})")
        with compute_guard("Independent t-test"):
            out = pg.ttest(a, b, paired=False, alternative=alternative, confidence=1 - alpha)
        title = f"Independent t-test — {column} by {group_by}"
        if a.size < 30 or b.size < 30:
            warnings.append("Small samples — check normality and consider Welch / Mann-Whitney.")
        plots.append(PlotSpec(
            type="boxplot",
            plotly=boxplot_spec({str(g1): a.tolist(), str(g2): b.tolist()},
                                title=f"{column} by {group_by}", y_label=column),
        ))

    # pingouin returns a single-row DataFrame
    row = out.iloc[0].to_dict()
    ci_key = next((k for k in row if k.startswith("CI")), None)
    ci = row.get(ci_key) if ci_key else None
    ci_low, ci_high = (float(ci[0]), float(ci[1])) if isinstance(ci, (list, tuple, np.ndarray)) else (None, None)
    p_val = float(row.get("p_val", row.get("p-val", float("nan"))))

    stats_out = {
        "test": title,
        "t": round(float(row.get("T", row.get("t", float("nan")))), 6),
        "df": float(row.get("dof", row.get("df", float("nan")))),
        "p_value": round(p_val, 6),
        "alternative": alternative,
        "alpha": alpha,
        "significant": bool(p_val < alpha),
        "ci_low": round(ci_low, 6) if ci_low is not None else None,
        "ci_high": round(ci_high, 6) if ci_high is not None else None,
        "cohen_d": round(float(row["cohen_d"]), 6) if "cohen_d" in row else None,
        "bf10": str(row["BF10"]) if "BF10" in row else None,
        "power": round(float(row["power"]), 6) if "power" in row else None,
    }

    table_df = pd.DataFrame([{
        "test": title,
        "t": stats_out["t"],
        "df": stats_out["df"],
        "p_value": stats_out["p_value"],
        f"ci_low ({int((1 - alpha) * 100)}%)": stats_out["ci_low"],
        f"ci_high ({int((1 - alpha) * 100)}%)": stats_out["ci_high"],
        "cohen_d": stats_out["cohen_d"],
        "significant": "yes" if stats_out["significant"] else "no",
    }])
    table = df_to_table(table_df)

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots,
        warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
