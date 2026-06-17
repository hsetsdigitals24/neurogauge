import time
import math
from typing import Any
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.plots import path_diagram_spec

try:
    import semopy
    _SEMOPY_OK = True
except ImportError:
    _SEMOPY_OK = False

router = APIRouter(tags=["sem"], dependencies=[Depends(require_secret)])

# Known fit-index column name aliases across semopy versions
_FIT_ALIASES: dict[str, str] = {
    "cfi": "CFI",
    "tli": "TLI",
    "rmsea": "RMSEA",
    "srmr": "SRMR",
    "chi2": "chi2",
    "chi2 p-value": "chi2_p",
    "dof": "df",
    "aic": "AIC",
    "bic": "BIC",
}


def _clean(value: Any) -> Any:
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _coerce_float(val: Any) -> float | None:
    try:
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None


@router.post("/sem", response_model=AnalysisResponse)
def run_sem(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    if not _SEMOPY_OK:
        raise HTTPException(501, "semopy is not installed. Run: pip install semopy>=2.3")

    model_str: str = (req.variables.get("model") or "").strip()
    alpha: float = float(req.options.get("alpha", 0.05))
    z_crit = 1.96 if alpha == 0.05 else (2.576 if alpha == 0.01 else abs(float("nan")))

    if not model_str:
        raise HTTPException(400, "variables.model is required (semopy/lavaan syntax)")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")

    # Coerce all item columns to numeric — SEM operates on numeric data only.
    df = df.apply(pd.to_numeric, errors="coerce")
    df = df.dropna()
    if len(df) < 5:
        raise HTTPException(400, f"Need at least 5 complete rows, got {len(df)}")

    try:
        model = semopy.Model(model_str)
        model.fit(df)
    except Exception as exc:
        raise HTTPException(400, f"SEM fitting failed: {exc}")

    # ── Parameter estimates ────────────────────────────────────────────────────
    try:
        params: pd.DataFrame = model.inspect()
    except Exception as exc:
        raise HTTPException(400, f"Failed to extract parameters: {exc}")

    coef_rows: list[dict[str, Any]] = []
    for _, row in params.iterrows():
        lval = str(row.get("lval", ""))
        op = str(row.get("op", ""))
        rval = str(row.get("rval", ""))

        est = _coerce_float(row.get("Estimate", row.get("estimate")))
        se = _coerce_float(row.get("Std. Err.", row.get("std_err")))
        z_val = _coerce_float(row.get("z-value", row.get("z_value")))
        p_val = _coerce_float(row.get("p-value", row.get("p_value")))

        if est is None:
            continue

        ci_low = _clean(round(est - z_crit * se, 6)) if se is not None else None
        ci_high = _clean(round(est + z_crit * se, 6)) if se is not None else None
        coef_rows.append({
            "path": f"{lval} {op} {rval}",
            "lval": lval,
            "op": op,
            "rval": rval,
            "estimate": _clean(round(est, 6)),
            "std_error": _clean(round(se, 6)) if se is not None else None,
            "z": _clean(round(z_val, 6)) if z_val is not None else None,
            "p_value": _clean(round(p_val, 6)) if p_val is not None else None,
            "ci_low": ci_low,
            "ci_high": ci_high,
            "significant": "yes" if p_val is not None and p_val < alpha else "no",
        })

    # ── Fit indices ────────────────────────────────────────────────────────────
    fit_indices: dict[str, Any] = {}
    warnings: list[str] = []
    try:
        stats_df = semopy.calc_stats(model)
        # calc_stats returns a DataFrame; normalise to {name: value} dict
        if isinstance(stats_df, pd.DataFrame):
            for col in stats_df.columns:
                key = _FIT_ALIASES.get(col.lower(), col)
                val = _coerce_float(stats_df[col].iloc[0])
                fit_indices[key] = val
        elif hasattr(stats_df, "items"):
            for k, v in stats_df.items():
                key = _FIT_ALIASES.get(str(k).lower(), str(k))
                fit_indices[key] = _coerce_float(v)
    except Exception:
        warnings.append("Fit indices could not be computed (model may not have converged).")

    # ── Fit interpretation warnings ────────────────────────────────────────────
    cfi = fit_indices.get("CFI")
    rmsea = fit_indices.get("RMSEA")
    srmr = fit_indices.get("SRMR")
    if cfi is not None and cfi < 0.90:
        warnings.append(f"CFI = {cfi:.3f} is below the acceptable threshold of 0.90.")
    if rmsea is not None and rmsea > 0.08:
        warnings.append(f"RMSEA = {rmsea:.3f} exceeds acceptable threshold of 0.08.")
    if srmr is not None and srmr > 0.10:
        warnings.append(f"SRMR = {srmr:.3f} exceeds acceptable threshold of 0.10.")

    stats_out: dict[str, Any] = {
        "model": "SEM",
        "n": len(df),
        "fit_indices": fit_indices,
        "alpha": alpha,
        "coefficients": coef_rows,
    }

    table_df = pd.DataFrame([
        {"stat": k, "value": v}
        for k, v in fit_indices.items()
        if v is not None
    ] + [
        {"stat": f"path: {r['path']}", "value": r["estimate"]}
        for r in coef_rows
    ])
    table = df_to_table(table_df) if not table_df.empty else {"csv": "", "headers": [], "rows": []}

    plots: list[PlotSpec] = []
    try:
        if coef_rows:
            plots.append(PlotSpec(
                type="path_diagram",
                plotly=path_diagram_spec(coef_rows, title="SEM path diagram"),
            ))
    except Exception as exc:
        warnings.append(f"Path diagram could not be rendered: {exc}")

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out,
        table=TableBlock(**table),
        plots=plots,
        warnings=warnings,
        meta=Meta(n=len(df), duration_ms=duration_ms, version=VERSION),
    )
