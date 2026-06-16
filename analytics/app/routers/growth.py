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
from app.core.plots import line_trend_spec

router = APIRouter(tags=["growth"], dependencies=[Depends(require_secret)])


def _ordered_levels(series: pd.Series) -> list[Any]:
    uniq = series.dropna().unique().tolist()
    num = pd.to_numeric(pd.Series(uniq), errors="coerce")
    if not num.isna().any():
        return [u for _, u in sorted(zip(num.tolist(), uniq))]
    return sorted(uniq, key=str)


@router.post("/growth", response_model=AnalysisResponse)
def growth(req: AnalysisRequest) -> AnalysisResponse:
    """Longitudinal trend / growth curve: mean ± CI of a measure across ordered time points."""
    started = time.perf_counter()

    dv = req.variables.get("dv")
    time_col = req.variables.get("time")
    group_col = req.variables.get("group")
    ci_level = float(req.options.get("ci_level", 0.95))
    if not (0 < ci_level < 1):
        raise HTTPException(400, "ci_level must be between 0 and 1")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    if not dv or dv not in df.columns:
        raise HTTPException(400, "variables.dv required and must exist")
    if not time_col or time_col not in df.columns:
        raise HTTPException(400, "variables.time required and must exist")
    if group_col and group_col not in df.columns:
        raise HTTPException(400, f"group '{group_col}' not found")

    df[dv] = pd.to_numeric(df[dv], errors="coerce")
    df = df.dropna(subset=[dv, time_col])
    if df.empty:
        raise HTTPException(400, "no rows remain after dropping missing dv/time")

    levels = _ordered_levels(df[time_col])
    x_labels = [str(lv) for lv in levels]

    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    series_by_group: dict[str, dict[str, list[float]]] = {}

    groups = df.groupby(group_col, dropna=False) if group_col else [("", df)]
    for grp, sub in groups:
        gl = str(grp)
        means, lows, highs = [], [], []
        for lv in levels:
            vals = pd.to_numeric(sub.loc[sub[time_col] == lv, dv], errors="coerce").dropna().to_numpy(dtype=float)
            n = vals.size
            if n == 0:
                m = lo = hi = float("nan")
            else:
                m = float(np.mean(vals))
                if n > 1 and np.std(vals, ddof=1) > 0:
                    se = float(np.std(vals, ddof=1)) / np.sqrt(n)
                    tcrit = float(stats.t.ppf(1 - (1 - ci_level) / 2, df=n - 1))
                    lo, hi = m - tcrit * se, m + tcrit * se
                else:
                    lo = hi = m
            means.append(m)
            lows.append(lo)
            highs.append(hi)
            rows.append({
                "group": gl, "time": str(lv), "n": int(n),
                "mean": round(m, 6) if n else None,
                "ci_low": round(lo, 6) if n else None,
                "ci_high": round(hi, 6) if n else None,
            })
        series_by_group[gl] = {"mean": means, "ci_low": lows, "ci_high": highs}

    if len(levels) < 2:
        warnings.append("Only one time level found — a trend needs at least two ordered time points.")

    table_df = pd.DataFrame(rows)
    if not group_col:
        table_df = table_df.drop(columns=["group"], errors="ignore")
    table = df_to_table(table_df)

    plots = [PlotSpec(
        type="growth",
        plotly=line_trend_spec(x_labels, series_by_group,
                               title=f"{dv} over {time_col}", y_label=dv),
    )]

    stats_out = {
        "dv": dv,
        "time": time_col,
        "group": group_col,
        "ci_level": ci_level,
        "time_levels": x_labels,
        "rows": rows,
    }

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
