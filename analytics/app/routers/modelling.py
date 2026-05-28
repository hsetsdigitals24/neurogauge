import time
import math
from typing import Any
import pandas as pd
import statsmodels.formula.api as smf
import statsmodels.api as sm
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.plots import residuals_spec, coefficient_forest_spec

router = APIRouter(tags=["modelling"], dependencies=[Depends(require_secret)])

_FAMILIES: dict[str, Any] = {
    "gaussian": sm.families.Gaussian(),
    "poisson": sm.families.Poisson(),
    "gamma": sm.families.Gamma(),
    "binomial": sm.families.Binomial(),
    "negativebinomial": sm.families.NegativeBinomial(),
}


def _clean(value: Any) -> Any:
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _safe_col(name: str) -> str:
    """Make a column name safe for use in R-style formulas."""
    return name.replace(" ", "_").replace("-", "_").replace(".", "_")


@router.post("/modelling", response_model=AnalysisResponse)
def run_modelling(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    formula: str = (req.variables.get("formula") or "").strip()
    family_name: str = (req.variables.get("family") or "gaussian").lower().replace(" ", "")
    alpha: float = float(req.options.get("alpha", 0.05))

    if not formula:
        raise HTTPException(400, "variables.formula is required (e.g. 'y ~ x1 + x2')")
    if family_name not in _FAMILIES:
        raise HTTPException(400, f"Unknown family '{family_name}'. Choose from: {list(_FAMILIES)}")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")

    # Sanitise column names: formula identifiers can't contain spaces or hyphens.
    col_map = {c: _safe_col(c) for c in df.columns if _safe_col(c) != c}
    if col_map:
        df = df.rename(columns=col_map)
        for orig, safe in col_map.items():
            formula = formula.replace(orig, safe)

    # Drop rows with any NA in columns referenced by the formula.
    df = df.dropna()
    if len(df) < 3:
        raise HTTPException(400, f"Need at least 3 complete rows after dropping NAs, got {len(df)}")

    try:
        fit = smf.glm(formula=formula, data=df, family=_FAMILIES[family_name]).fit()
    except Exception as exc:
        raise HTTPException(400, f"GLM fitting failed: {exc}")

    ci = fit.conf_int(alpha=alpha)
    coef_rows: list[dict[str, Any]] = []
    for name in fit.params.index:
        p = float(fit.pvalues[name])
        coef_rows.append({
            "name": str(name),
            "estimate": _clean(round(float(fit.params[name]), 6)),
            "std_error": _clean(round(float(fit.bse[name]), 6)),
            "z": _clean(round(float(fit.tvalues[name]), 6)),
            "p_value": _clean(round(p, 6)),
            "ci_low": _clean(round(float(ci.loc[name, 0]), 6)),
            "ci_high": _clean(round(float(ci.loc[name, 1]), 6)),
            "significant": "yes" if p < alpha else "no",
        })

    # McFadden pseudo-R² (meaningful for non-Gaussian; approximate for Gaussian)
    try:
        pseudo_r2 = _clean(round(1.0 - fit.llf / fit.llnull, 6))
    except Exception:
        pseudo_r2 = None

    stats_out: dict[str, Any] = {
        "model": "GLM",
        "family": family_name,
        "formula": formula,
        "n": int(fit.nobs),
        "df_model": int(fit.df_model),
        "df_resid": int(fit.df_resid),
        "deviance": _clean(round(float(fit.deviance), 6)),
        "null_deviance": _clean(round(float(fit.null_deviance), 6)),
        "log_likelihood": _clean(round(float(fit.llf), 6)),
        "aic": _clean(round(float(fit.aic), 4)),
        "bic": _clean(round(float(fit.bic), 4)),
        "pseudo_r_squared": pseudo_r2,
        "alpha": alpha,
        "coefficients": coef_rows,
    }

    table = df_to_table(pd.DataFrame(coef_rows))

    non_intercept = [r for r in coef_rows if r["name"].lower() not in {"intercept", "const"}]
    plots: list[PlotSpec] = [
        PlotSpec(
            type="coefficients",
            plotly=coefficient_forest_spec(
                non_intercept,
                title=f"Coefficients ({int((1 - alpha) * 100)}% CI)",
            ),
        ),
        PlotSpec(
            type="residuals",
            plotly=residuals_spec(
                fit.fittedvalues.tolist(),
                fit.resid_response.tolist(),
                title="Response residuals vs fitted",
            ),
        ),
    ]

    warnings: list[str] = []
    if family_name == "gaussian":
        warnings.append("For Gaussian family, this is equivalent to OLS. Pseudo-R² uses log-likelihood approximation.")

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out,
        table=TableBlock(**table),
        plots=plots,
        warnings=warnings,
        meta=Meta(n=int(fit.nobs), duration_ms=duration_ms, version=VERSION),
    )
