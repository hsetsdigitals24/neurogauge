import time
from typing import Any
import numpy as np
import pandas as pd
from scipy import stats
from fastapi import APIRouter, Depends, HTTPException

from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.plots import boxplot_spec, mean_ci_bar_spec, pie_spec, radar_spec
from app import VERSION

router = APIRouter(tags=["descriptive"], dependencies=[Depends(require_secret)])


def _describe_column(series: pd.Series, ci_level: float) -> dict[str, Any]:
    arr = pd.to_numeric(series, errors="coerce").dropna().to_numpy(dtype=float)
    n = int(arr.size)
    if n == 0:
        return {
            "n": 0, "mean": None, "median": None, "mode": None,
            "sd": None, "se": None, "min": None, "max": None,
            "q1": None, "q3": None, "iqr": None,
            "ci_low": None, "ci_high": None,
        }

    mean = float(np.mean(arr))
    median = float(np.median(arr))
    q1 = float(np.quantile(arr, 0.25))
    q3 = float(np.quantile(arr, 0.75))
    iqr = q3 - q1
    try:
        mode_res = stats.mode(arr, keepdims=False, nan_policy="omit")
        mode_val = float(mode_res.mode) if mode_res.count > 0 else None
    except Exception:
        mode_val = None

    sd = float(np.std(arr, ddof=1)) if n > 1 else 0.0
    se = sd / np.sqrt(n) if n > 1 else 0.0

    if n > 1 and se > 0:
        alpha = 1.0 - ci_level
        t_crit = float(stats.t.ppf(1 - alpha / 2, df=n - 1))
        ci_low = mean - t_crit * se
        ci_high = mean + t_crit * se
    else:
        ci_low = ci_high = mean

    return {
        "n": n,
        "mean": round(mean, 6),
        "median": round(median, 6),
        "mode": round(mode_val, 6) if mode_val is not None else None,
        "sd": round(sd, 6),
        "se": round(se, 6),
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "q1": round(q1, 6),
        "q3": round(q3, 6),
        "iqr": round(iqr, 6),
        "ci_low": round(ci_low, 6),
        "ci_high": round(ci_high, 6),
    }


@router.post("/descriptive", response_model=AnalysisResponse)
def descriptive(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    columns = req.variables.get("columns") or []
    cat_columns = req.variables.get("cat_columns") or []
    group_by = req.variables.get("group_by")
    ci_level = float(req.options.get("ci_level", 0.95))
    if not (0 < ci_level < 1):
        raise HTTPException(400, "ci_level must be between 0 and 1")
    error_bar = str(req.options.get("error_bar", "ci")).lower()
    if error_bar not in {"ci", "se", "sd"}:
        raise HTTPException(400, "error_bar must be one of 'ci', 'se', 'sd'")
    if not columns and not cat_columns:
        raise HTTPException(400, "provide variables.columns and/or variables.cat_columns")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    missing = [c for c in [*columns, *cat_columns] if c not in df.columns]
    if missing:
        raise HTTPException(400, f"columns not found in data: {missing}")
    if group_by and group_by not in df.columns:
        raise HTTPException(400, f"group_by '{group_by}' not found in data")

    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    stats_out: dict[str, Any] = {}
    plots: list[PlotSpec] = []
    # variable -> { group_label -> raw float values } for plotting
    series_per_var: dict[str, dict[str, list[float]]] = {}

    def _values(series: pd.Series) -> list[float]:
        arr = pd.to_numeric(series, errors="coerce").dropna().to_numpy(dtype=float)
        return arr.tolist()

    if group_by:
        for col in columns:
            per_group: dict[str, Any] = {}
            series_per_var[col] = {}
            for grp, sub in df.groupby(group_by, dropna=False):
                label = str(grp)
                d = _describe_column(sub[col], ci_level)
                per_group[label] = d
                rows.append({"variable": col, "group": label, **d})
                series_per_var[col][label] = _values(sub[col])
            stats_out[col] = per_group
    else:
        for col in columns:
            d = _describe_column(df[col], ci_level)
            stats_out[col] = d
            rows.append({"variable": col, "group": "", **d})
            series_per_var[col] = {col: _values(df[col])}

    for r in rows:
        if r["n"] < 3:
            warnings.append(
                f"{r['variable']}{('/' + r['group']) if r['group'] else ''}: n={r['n']} — CI not meaningful"
            )

    # Build plots per variable. Plots are best-effort: the stats above are already computed and
    # valuable, so a plotting failure on degenerate data is downgraded to a warning, never a 500.
    try:
        for col, by_group in series_per_var.items():
            if not any(len(v) >= 2 for v in by_group.values()):
                continue
            plots.append(PlotSpec(
                type="boxplot",
                plotly=boxplot_spec(by_group, title=f"Distribution — {col}", y_label=col),
            ))
            bar_rows = [
                r for r in rows
                if r["variable"] == col and r.get("mean") is not None and r.get("ci_low") is not None
            ]
            if bar_rows:
                label = {"ci": "CI", "se": "SE", "sd": "SD"}[error_bar]
                plots.append(PlotSpec(
                    type="bar_ci",
                    plotly=mean_ci_bar_spec(
                        bar_rows, title=f"Mean ± {label} — {col}", y_label=col, error_bar=error_bar
                    ),
                ))

        # Radar / spider profile of group means across >= 3 numeric variables (z-scored so axes
        # are comparable). Only meaningful when grouping, but rendered for the overall sample too.
        if len(columns) >= 3:
            z_means: dict[str, list[float]] = {}
            norm: dict[str, tuple[float, float]] = {}
            for col in columns:
                arr = pd.to_numeric(df[col], errors="coerce")
                norm[col] = (float(arr.mean()), float(arr.std(ddof=1)) or 1.0)
            groups = df.groupby(group_by, dropna=False) if group_by else [("Overall", df)]
            for grp, sub in groups:
                vals = []
                for col in columns:
                    m, sd = norm[col]
                    vals.append(round((float(pd.to_numeric(sub[col], errors="coerce").mean()) - m) / sd, 4))
                z_means[str(grp)] = vals
            plots.append(PlotSpec(
                type="radar",
                plotly=radar_spec(list(columns), z_means, title="Standardised profile (z-scores)"),
            ))
    except Exception as e:  # noqa: BLE001
        warnings.append(f"Some plots could not be generated: {e}")

    # Categorical frequencies + pie charts.
    cat_stats: dict[str, Any] = {}
    for col in cat_columns:
        counts = df[col].astype("string").fillna("(missing)").value_counts()
        total = int(counts.sum())
        labels = [str(k) for k in counts.index]
        values = [int(v) for v in counts.values]
        cat_stats[col] = {
            "n": total,
            "levels": [
                {"value": lab, "count": v, "percent": round(100 * v / total, 2) if total else 0}
                for lab, v in zip(labels, values)
            ],
        }
        if values:
            plots.append(PlotSpec(
                type="pie",
                plotly=pie_spec(labels, values, title=f"{col} — frequencies"),
            ))
    if cat_stats:
        stats_out["categorical"] = cat_stats

    table_df = pd.DataFrame(rows)
    if not group_by:
        table_df = table_df.drop(columns=["group"], errors="ignore")
    if table_df.empty:
        # Categorical-only request: build a frequency table instead.
        freq_rows = [
            {"variable": col, "value": lvl["value"], "count": lvl["count"], "percent": lvl["percent"]}
            for col, cs in cat_stats.items() for lvl in cs["levels"]
        ]
        table = df_to_table(pd.DataFrame(freq_rows)) if freq_rows else {"csv": "", "headers": [], "rows": []}
    else:
        table = df_to_table(table_df)

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out,
        table=TableBlock(**table),
        plots=plots,
        warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
