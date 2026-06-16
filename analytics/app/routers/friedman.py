import time
from typing import Any
import pandas as pd
import pingouin as pg
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.plots import boxplot_spec

router = APIRouter(tags=["friedman"], dependencies=[Depends(require_secret)])


@router.post("/friedman", response_model=AnalysisResponse)
def friedman(req: AnalysisRequest) -> AnalysisResponse:
    """Friedman test — non-parametric alternative to the repeated-measures ANOVA.

    Optional pairwise Wilcoxon signed-rank post-hoc (Bonferroni) when significant.
    """
    started = time.perf_counter()

    dv = req.variables.get("dv")
    within = req.variables.get("within")
    subject = req.variables.get("subject")
    post_hoc = (req.options.get("post_hoc") or "wilcoxon").lower()
    alpha = float(req.options.get("alpha", 0.05))
    if post_hoc not in {"wilcoxon", "none"}:
        raise HTTPException(400, "options.post_hoc must be: wilcoxon or none")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    if not dv or dv not in df.columns:
        raise HTTPException(400, "variables.dv required and must exist")
    if not within or within not in df.columns:
        raise HTTPException(400, "variables.within required and must exist")
    if not subject or subject not in df.columns:
        raise HTTPException(400, "variables.subject required and must exist")

    df[dv] = pd.to_numeric(df[dv], errors="coerce")
    df = df.dropna(subset=[dv, within, subject])
    n_levels = df[within].nunique()
    if n_levels < 2:
        raise HTTPException(400, f"within must have >= 2 levels, found {n_levels}")

    warnings: list[str] = []
    out = pg.friedman(data=df, dv=dv, within=within, subject=subject)
    row = out.iloc[0].to_dict()
    p_val = float(row.get("p-unc", row.get("p_unc", float("nan"))))
    q_stat = float(row.get("Q", row.get("chi2", float("nan"))))
    w_stat = float(row["W"]) if "W" in row else None
    title = f"Friedman — {dv} within {within}"

    stats_out: dict[str, Any] = {
        "test": title,
        "q": round(q_stat, 6),
        "kendall_w": round(w_stat, 6) if w_stat is not None else None,
        "df": float(row.get("ddof1", n_levels - 1)),
        "p_value": round(p_val, 6),
        "alpha": alpha,
        "significant": bool(p_val < alpha),
        "post_hoc_method": post_hoc,
    }

    # Pairwise Wilcoxon signed-rank post-hoc (Bonferroni) when significant
    if post_hoc == "wilcoxon" and p_val < alpha:
        try:
            ph = pg.pairwise_tests(
                data=df, dv=dv, within=within, subject=subject,
                parametric=False, padjust="bonf",
            )
            if ph is not None and len(ph) > 0:
                stats_out["post_hoc"] = df_to_table(ph.round(6))
        except Exception as e:
            warnings.append(f"Pairwise Wilcoxon post-hoc failed: {e}")

    table_df = pd.DataFrame([{
        "test": title,
        "Q": stats_out["q"],
        "kendall_w": stats_out["kendall_w"],
        "df": stats_out["df"],
        "p_value": stats_out["p_value"],
        "significant": "yes" if stats_out["significant"] else "no",
    }])
    table = df_to_table(table_df)

    series_by_group: dict[str, list[float]] = {}
    for grp, sub in df.groupby(within, dropna=False):
        series_by_group[str(grp)] = pd.to_numeric(sub[dv], errors="coerce").dropna().tolist()
    plots = [PlotSpec(
        type="boxplot",
        plotly=boxplot_spec(series_by_group, title=f"{dv} by {within}", y_label=dv),
    )]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
