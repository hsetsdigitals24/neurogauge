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
from app.core.plots import histogram_spec, qq_plot_spec

router = APIRouter(tags=["normality"], dependencies=[Depends(require_secret)])


SHAPIRO_MAX_N = 5000


def _normality_one(arr: np.ndarray, tests: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {"n": int(arr.size)}
    if arr.size < 3:
        return out

    if "shapiro" in tests:
        if arr.size > SHAPIRO_MAX_N:
            # Shapiro-Wilk is unreliable (and slow) for very large n — use the
            # D'Agostino-Pearson K² omnibus test instead, which scales to large samples.
            try:
                k2, p = stats.normaltest(arr)
                out["dagostino_k2"] = round(float(k2), 6)
                out["dagostino_p"] = round(float(p), 6)
            except Exception as e:
                out["dagostino_error"] = str(e)
        else:
            try:
                w, p = stats.shapiro(arr)
                out["shapiro_w"] = round(float(w), 6)
                out["shapiro_p"] = round(float(p), 6)
            except Exception as e:
                out["shapiro_error"] = str(e)

    if "ks" in tests:
        # Standardize against estimated mean/SD — Lilliefors-style.
        mu, sigma = float(np.mean(arr)), float(np.std(arr, ddof=1))
        if sigma > 0:
            d, p = stats.kstest((arr - mu) / sigma, "norm")
            out["ks_d"] = round(float(d), 6)
            out["ks_p"] = round(float(p), 6)
        else:
            out["ks_error"] = "zero variance"

    out["skewness"] = round(float(stats.skew(arr)), 6)
    out["kurtosis"] = round(float(stats.kurtosis(arr)), 6)  # excess kurtosis
    return out


@router.post("/normality", response_model=AnalysisResponse)
def normality(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    column = req.variables.get("column")
    group_by = req.variables.get("group_by")
    tests = req.options.get("tests") or ["shapiro", "ks"]
    if not column:
        raise HTTPException(400, "variables.column required")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    if column not in df.columns:
        raise HTTPException(400, f"column '{column}' not found in data")
    if group_by and group_by not in df.columns:
        raise HTTPException(400, f"group_by '{group_by}' not found in data")

    warnings: list[str] = []
    stats_out: dict[str, Any] = {}
    rows: list[dict[str, Any]] = []
    plots: list[PlotSpec] = []

    def emit(label: str, arr: np.ndarray) -> None:
        result = _normality_one(arr, tests)
        stats_out[label] = result
        rows.append({"group": label, **{k: v for k, v in result.items() if k != "n"}, "n": result["n"]})
        if arr.size < 8:
            warnings.append(f"{label}: n={arr.size} — normality tests unreliable")
        elif "shapiro" in tests and arr.size > SHAPIRO_MAX_N:
            warnings.append(
                f"{label}: n={arr.size} — Shapiro-Wilk skipped above n={SHAPIRO_MAX_N}; "
                "reported D'Agostino K² (and K-S) instead."
            )
        if arr.size >= 2:
            plots.append(PlotSpec(type="histogram", plotly=histogram_spec(arr.tolist(), title=f"Histogram — {label}")))
            plots.append(PlotSpec(type="qq", plotly=qq_plot_spec(arr.tolist(), title=f"Q–Q plot — {label}")))

    if group_by:
        for grp, sub in df.groupby(group_by, dropna=False):
            arr = pd.to_numeric(sub[column], errors="coerce").dropna().to_numpy(dtype=float)
            emit(str(grp), arr)
    else:
        arr = pd.to_numeric(df[column], errors="coerce").dropna().to_numpy(dtype=float)
        emit(column, arr)

    table_df = pd.DataFrame(rows)
    table = df_to_table(table_df)

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out,
        table=TableBlock(**table),
        plots=plots,
        warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
