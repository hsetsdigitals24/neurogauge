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
from app.core.plots import boxplot_spec

router = APIRouter(tags=["anova"], dependencies=[Depends(require_secret)])


@router.post("/anova", response_model=AnalysisResponse)
def anova(req: AnalysisRequest) -> AnalysisResponse:
    started = time.perf_counter()

    dv = req.variables.get("dv")
    between = req.variables.get("between") or []
    within = req.variables.get("within")
    subject = req.variables.get("subject")
    post_hoc = (req.options.get("post_hoc") or "tukey").lower()
    alpha = float(req.options.get("alpha", 0.05))

    if not dv:
        raise HTTPException(400, "variables.dv (dependent variable) required")
    if isinstance(between, str):
        between = [between]
    if not between and not within:
        raise HTTPException(400, "provide variables.between (1 or 2 factors) and/or variables.within for RM-ANOVA")
    if post_hoc not in {"tukey", "bonferroni", "holm", "none"}:
        raise HTTPException(400, "options.post_hoc must be: tukey, bonferroni, holm, or none")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    needed = [dv, *between, *([within] if within else []), *([subject] if subject else [])]
    for c in needed:
        if c not in df.columns:
            raise HTTPException(400, f"column '{c}' not found")

    df[dv] = pd.to_numeric(df[dv], errors="coerce")
    # Drop rows missing the dv OR any grouping/subject column — pingouin rejects NaNs in
    # the factor/subject columns (e.g. a within factor that is entirely empty).
    factor_cols = [*between, *([within] if within else []), *([subject] if subject else [])]
    df = df.dropna(subset=[dv, *factor_cols])
    if df.empty:
        raise HTTPException(400, "no rows remain after dropping rows with missing dv / factor values")

    # Each grouping factor must have at least 2 levels to compare.
    for f in [*between, *([within] if within else [])]:
        levels = df[f].nunique(dropna=True)
        if levels < 2:
            raise HTTPException(
                400, f"factor '{f}' has {levels} level(s) after dropping missing values — need at least 2"
            )

    plots: list[PlotSpec] = []
    warnings: list[str] = []

    # Choose ANOVA flavor. Wrap the fit so model-assumption failures surface as a clean
    # 400 with pingouin's explanation instead of an opaque 500.
    try:
        if within:
            if not subject:
                raise HTTPException(400, "RM-ANOVA requires variables.subject (the within-subject id column)")
            aov = pg.rm_anova(data=df, dv=dv, within=within, subject=subject, detailed=True)
            title = f"Repeated-measures ANOVA — {dv} within {within}"
        elif len(between) == 1:
            aov = pg.anova(data=df, dv=dv, between=between[0], detailed=True)
            title = f"One-way ANOVA — {dv} between {between[0]}"
        elif len(between) == 2:
            aov = pg.anova(data=df, dv=dv, between=between, detailed=True)
            title = f"Two-way ANOVA — {dv} between {between[0]} × {between[1]}"
        else:
            raise HTTPException(400, "variables.between supports at most 2 factors")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"ANOVA could not be computed: {exc}")

    # Build a clean stats table from the ANOVA result
    aov_rows = aov.to_dict(orient="records")
    main_table = df_to_table(aov.round(6))

    # Post-hoc: only meaningful for single between factor or within
    posthoc_table: dict[str, Any] | None = None
    if post_hoc != "none":
        try:
            if within and not between:
                ph = pg.pairwise_tests(
                    data=df, dv=dv, within=within, subject=subject,
                    padjust="bonf" if post_hoc == "bonferroni" else ("holm" if post_hoc == "holm" else "none"),
                )
            elif len(between) == 1:
                if post_hoc == "tukey":
                    ph = pg.pairwise_tukey(data=df, dv=dv, between=between[0])
                else:
                    ph = pg.pairwise_tests(
                        data=df, dv=dv, between=between[0],
                        padjust="bonf" if post_hoc == "bonferroni" else "holm",
                    )
            else:
                ph = None

            if ph is not None and len(ph) > 0:
                posthoc_table = df_to_table(ph.round(6))
        except Exception as e:
            warnings.append(f"Post-hoc failed: {e}")

    # Box plot of dv by primary grouping factor
    group_col = between[0] if between else None
    if group_col is not None:
        series_by_group: dict[str, list[float]] = {}
        for grp, sub in df.groupby(group_col, dropna=False):
            series_by_group[str(grp)] = pd.to_numeric(sub[dv], errors="coerce").dropna().tolist()
        plots.append(PlotSpec(
            type="boxplot",
            plotly=boxplot_spec(series_by_group, title=f"{dv} by {group_col}", y_label=dv),
        ))

    stats_out = {
        "test": title,
        "alpha": alpha,
        "rows": aov_rows,
        "post_hoc_method": post_hoc,
    }
    if posthoc_table:
        stats_out["post_hoc"] = posthoc_table

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**main_table), plots=plots, warnings=warnings,
        meta=Meta(n=int(len(df)), duration_ms=duration_ms, version=VERSION),
    )
