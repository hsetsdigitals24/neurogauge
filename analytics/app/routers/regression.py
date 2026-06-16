import time
import math
from typing import Any
import numpy as np
import pandas as pd
import statsmodels.api as sm
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.plots import residuals_spec, coefficient_forest_spec, scatter_spec, confusion_matrix_spec

router = APIRouter(tags=["regression"], dependencies=[Depends(require_secret)])


def _design_matrix(df: pd.DataFrame, predictors: list[str]) -> tuple[pd.DataFrame, list[str]]:
    """Build a design matrix, one-hot-encoding non-numeric predictors."""
    parts: list[pd.DataFrame] = []
    names: list[str] = []
    for p in predictors:
        col = df[p]
        if pd.api.types.is_numeric_dtype(col):
            parts.append(col.astype(float).to_frame(p))
            names.append(p)
        else:
            dummies = pd.get_dummies(col.astype(str), prefix=p, drop_first=True, dtype=float)
            parts.append(dummies)
            names.extend(dummies.columns.tolist())
    X = pd.concat(parts, axis=1) if parts else pd.DataFrame(index=df.index)
    return X, names


def _clean(value: Any) -> Any:
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


@router.post("/regression/linear", response_model=AnalysisResponse)
def linear_regression(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    dv = req.variables.get("dv")
    predictors = req.variables.get("predictors") or []
    alpha = float(req.options.get("alpha", 0.05))
    add_constant = bool(req.options.get("intercept", True))

    if not dv:
        raise HTTPException(400, "variables.dv required")
    if not predictors:
        raise HTTPException(400, "variables.predictors must be a non-empty list")

    df = pd.DataFrame(req.data)
    needed = [dv, *predictors]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise HTTPException(400, f"columns not found: {missing}")

    df = df[needed].copy()
    df[dv] = pd.to_numeric(df[dv], errors="coerce")
    df = df.dropna()
    if len(df) < len(predictors) + 2:
        raise HTTPException(400, f"need at least {len(predictors) + 2} complete rows, got {len(df)}")

    X, names = _design_matrix(df, predictors)
    y = df[dv].to_numpy(dtype=float)
    if add_constant:
        X = sm.add_constant(X, has_constant="add")
        names = ["(intercept)", *names]

    model = sm.OLS(y, X.astype(float))
    res = model.fit()

    ci = res.conf_int(alpha=alpha)
    coef_rows: list[dict[str, Any]] = []
    for i, name in enumerate(names):
        coef_rows.append({
            "name": name,
            "estimate": _clean(round(float(res.params.iloc[i]), 6)),
            "std_error": _clean(round(float(res.bse.iloc[i]), 6)),
            "t": _clean(round(float(res.tvalues.iloc[i]), 6)),
            "p_value": _clean(round(float(res.pvalues.iloc[i]), 6)),
            "ci_low": _clean(round(float(ci.iloc[i, 0]), 6)),
            "ci_high": _clean(round(float(ci.iloc[i, 1]), 6)),
            "significant": "yes" if float(res.pvalues.iloc[i]) < alpha else "no",
        })

    stats_out = {
        "model": "OLS",
        "dv": dv,
        "predictors": names,
        "n": int(res.nobs),
        "df_model": int(res.df_model),
        "df_resid": int(res.df_resid),
        "r_squared": round(float(res.rsquared), 6),
        "adj_r_squared": round(float(res.rsquared_adj), 6),
        "f_statistic": _clean(round(float(res.fvalue), 6)),
        "f_p_value": _clean(round(float(res.f_pvalue), 6)),
        "aic": _clean(round(float(res.aic), 4)),
        "bic": _clean(round(float(res.bic), 4)),
        "alpha": alpha,
        "coefficients": coef_rows,
    }

    table = df_to_table(pd.DataFrame(coef_rows))

    plots: list[PlotSpec] = []
    fitted = res.fittedvalues.tolist()
    residuals = res.resid.tolist()
    plots.append(PlotSpec(type="residuals", plotly=residuals_spec(fitted, residuals)))
    plots.append(PlotSpec(
        type="coefficients",
        plotly=coefficient_forest_spec(
            [r for r in coef_rows if r["name"] != "(intercept)"],
            title="Coefficients (β) with 95% CI",
        ),
    ))
    if len(predictors) == 1 and pd.api.types.is_numeric_dtype(df[predictors[0]]):
        plots.append(PlotSpec(
            type="scatter",
            plotly=scatter_spec(
                df[predictors[0]].tolist(), y.tolist(),
                x_label=predictors[0], y_label=dv,
                title=f"{dv} vs {predictors[0]} (R²={res.rsquared:.3f})",
            ),
        ))

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=[],
        meta=Meta(n=int(res.nobs), duration_ms=duration_ms, version=VERSION),
    )


@router.post("/regression/logistic", response_model=AnalysisResponse)
def logistic_regression(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    dv = req.variables.get("dv")
    predictors = req.variables.get("predictors") or []
    alpha = float(req.options.get("alpha", 0.05))
    positive_label = req.variables.get("positive_label")  # explicit "1" value for the DV

    if not dv:
        raise HTTPException(400, "variables.dv required")
    if not predictors:
        raise HTTPException(400, "variables.predictors must be a non-empty list")

    df = pd.DataFrame(req.data)
    needed = [dv, *predictors]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise HTTPException(400, f"columns not found: {missing}")

    df = df[needed].copy().dropna()
    raw_dv = df[dv]
    # Build binary 0/1 target.
    if pd.api.types.is_bool_dtype(raw_dv):
        y = raw_dv.astype(int).to_numpy()
        positive_label = "True"
    elif pd.api.types.is_numeric_dtype(raw_dv):
        uniq = sorted({float(v) for v in raw_dv.unique()})
        if uniq == [0.0, 1.0]:
            y = raw_dv.astype(int).to_numpy()
            positive_label = "1"
        else:
            raise HTTPException(400, f"numeric DV must be 0/1, got {uniq}")
    else:
        levels = sorted(raw_dv.astype(str).unique().tolist())
        if len(levels) != 2:
            raise HTTPException(400, f"DV must be binary, found {len(levels)} levels: {levels}")
        pos = positive_label if positive_label in levels else levels[-1]
        y = (raw_dv.astype(str) == pos).astype(int).to_numpy()
        positive_label = pos

    X, names = _design_matrix(df, predictors)
    X = sm.add_constant(X, has_constant="add").astype(float)
    names = ["(intercept)", *names]

    try:
        res = sm.Logit(y, X).fit(disp=False)
    except Exception as e:
        raise HTTPException(400, f"Logistic regression failed: {e}")

    ci = res.conf_int(alpha=alpha)
    coef_rows: list[dict[str, Any]] = []
    for i, name in enumerate(names):
        beta = float(res.params.iloc[i])
        lo, hi = float(ci.iloc[i, 0]), float(ci.iloc[i, 1])
        coef_rows.append({
            "name": name,
            "beta": _clean(round(beta, 6)),
            "odds_ratio": _clean(round(math.exp(beta), 6)),
            "or_ci_low": _clean(round(math.exp(lo), 6)),
            "or_ci_high": _clean(round(math.exp(hi), 6)),
            "std_error": _clean(round(float(res.bse.iloc[i]), 6)),
            "z": _clean(round(float(res.tvalues.iloc[i]), 6)),
            "p_value": _clean(round(float(res.pvalues.iloc[i]), 6)),
            "significant": "yes" if float(res.pvalues.iloc[i]) < alpha else "no",
        })

    # Classification metrics at the 0.5 threshold.
    prob = res.predict(X)
    pred = (prob >= 0.5).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum())
    tn = int(((pred == 0) & (y == 0)).sum())
    fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    accuracy = (tp + tn) / max(1, tp + tn + fp + fn)
    sensitivity = tp / max(1, tp + fn)
    specificity = tn / max(1, tn + fp)

    stats_out = {
        "model": "Logit",
        "dv": dv,
        "positive_label": positive_label,
        "predictors": names,
        "n": int(res.nobs),
        "pseudo_r_squared": _clean(round(float(res.prsquared), 6)),
        "log_likelihood": _clean(round(float(res.llf), 6)),
        "llr_p_value": _clean(round(float(res.llr_pvalue), 6)),
        "aic": _clean(round(float(res.aic), 4)),
        "bic": _clean(round(float(res.bic), 4)),
        "accuracy_at_0.5": round(accuracy, 6),
        "sensitivity_at_0.5": round(sensitivity, 6),
        "specificity_at_0.5": round(specificity, 6),
        "confusion_matrix_at_0.5": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
        "alpha": alpha,
        "coefficients": coef_rows,
    }

    table = df_to_table(pd.DataFrame(coef_rows))

    plots = [
        PlotSpec(
            type="odds_ratios",
            plotly=coefficient_forest_spec(
                [
                    {"name": r["name"], "estimate": r["odds_ratio"],
                     "ci_low": r["or_ci_low"], "ci_high": r["or_ci_high"]}
                    for r in coef_rows if r["name"] != "(intercept)"
                ],
                title="Odds ratios with 95% CI",
                x_label="odds ratio (log-spaced reference at 1)",
            ),
        ),
        PlotSpec(
            type="confusion_matrix",
            plotly=confusion_matrix_spec(tp, tn, fp, fn,
                                         title="Confusion matrix (threshold = 0.5)"),
        ),
    ]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=[],
        meta=Meta(n=int(res.nobs), duration_ms=duration_ms, version=VERSION),
    )
