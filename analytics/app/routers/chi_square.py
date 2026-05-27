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
from app.core.plots import heatmap_spec

router = APIRouter(tags=["chi-square"], dependencies=[Depends(require_secret)])


def _cramers_v(chi2: float, n: int, r: int, c: int) -> float:
    denom = n * (min(r, c) - 1)
    return float(np.sqrt(chi2 / denom)) if denom > 0 else 0.0


@router.post("/chi-square", response_model=AnalysisResponse)
def chi_square(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    row_col = req.variables.get("row")
    col_col = req.variables.get("column")
    alpha = float(req.options.get("alpha", 0.05))

    if not row_col or not col_col:
        raise HTTPException(400, "variables.row and variables.column required")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    for c in (row_col, col_col):
        if c not in df.columns:
            raise HTTPException(400, f"column '{c}' not found")

    # Contingency table
    ct = pd.crosstab(df[row_col].astype(str), df[col_col].astype(str))
    if ct.size == 0:
        raise HTTPException(400, "contingency table is empty")

    chi2, p, dof, expected = stats.chi2_contingency(ct.values)
    n = int(ct.values.sum())
    r_n, c_n = ct.shape
    v = _cramers_v(float(chi2), n, r_n, c_n)

    low_expected = int((np.asarray(expected) < 5).sum())
    warnings: list[str] = []
    if low_expected > 0:
        warnings.append(f"{low_expected} expected cell(s) < 5 — chi-square approximation may be unreliable; consider Fisher's exact.")

    stats_out = {
        "chi2": round(float(chi2), 6),
        "df": int(dof),
        "p_value": round(float(p), 6),
        "n": n,
        "cramers_v": round(v, 6),
        "rows": list(ct.index),
        "columns": list(ct.columns),
        "alpha": alpha,
        "significant": bool(float(p) < alpha),
    }

    # Output table = observed counts + summary row
    table_df = ct.copy()
    table_df.insert(0, "(row)", table_df.index)
    table_df.reset_index(drop=True, inplace=True)
    summary = {col: "" for col in table_df.columns}
    summary["(row)"] = f"χ²({dof})={chi2:.3f}  p={p:.4g}  Cramér's V={v:.3f}  n={n}"
    table_df = pd.concat([table_df, pd.DataFrame([summary])], ignore_index=True)
    table = df_to_table(table_df)

    plots = [
        PlotSpec(
            type="contingency_heatmap",
            plotly=heatmap_spec(
                ct.values.tolist(),
                [str(c) for c in ct.columns],
                [str(r) for r in ct.index],
                title=f"Observed counts — {row_col} × {col_col}",
                annotation_fmt=".0f",
            ),
        ),
        PlotSpec(
            type="expected_heatmap",
            plotly=heatmap_spec(
                np.asarray(expected).round(2).tolist(),
                [str(c) for c in ct.columns],
                [str(r) for r in ct.index],
                title="Expected counts",
                annotation_fmt=".2f",
            ),
        ),
    ]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
