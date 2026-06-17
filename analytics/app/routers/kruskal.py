import time
from typing import Any
import pandas as pd
import pingouin as pg
import scikit_posthocs as sp
from fastapi import APIRouter, Depends, HTTPException

from app import VERSION
from app.deps import require_secret
from app.schemas.common import AnalysisRequest, AnalysisResponse, Meta, PlotSpec, TableBlock
from app.core.csv_io import df_to_table
from app.core.guards import compute_guard
from app.core.plots import boxplot_spec

router = APIRouter(tags=["kruskal"], dependencies=[Depends(require_secret)])


@router.post("/kruskal-wallis", response_model=AnalysisResponse)
def kruskal_wallis(req: AnalysisRequest) -> AnalysisResponse:
    """Kruskal-Wallis H test — non-parametric alternative to the one-way ANOVA.

    Optional Dunn's post-hoc with Bonferroni correction when the omnibus test is significant.
    """
    started = time.perf_counter()

    dv = req.variables.get("dv")
    between = req.variables.get("between")
    post_hoc = (req.options.get("post_hoc") or "dunn").lower()
    alpha = float(req.options.get("alpha", 0.05))
    if post_hoc not in {"dunn", "none"}:
        raise HTTPException(400, "options.post_hoc must be: dunn or none")

    df = pd.DataFrame(req.data)
    if df.empty:
        raise HTTPException(400, "data is empty")
    if not dv or dv not in df.columns:
        raise HTTPException(400, "variables.dv required and must exist")
    if not between or between not in df.columns:
        raise HTTPException(400, "variables.between required and must exist")

    df[dv] = pd.to_numeric(df[dv], errors="coerce")
    df = df.dropna(subset=[dv, between])
    n_levels = df[between].nunique()
    if n_levels < 2:
        raise HTTPException(400, f"between must have >= 2 levels, found {n_levels}")

    warnings: list[str] = []
    with compute_guard("Kruskal-Wallis H"):
        out = pg.kruskal(data=df, dv=dv, between=between)
    row = out.iloc[0].to_dict()
    h = float(row["H"])
    p_val = float(row.get("p-unc", row.get("p_unc", float("nan"))))
    n = int(len(df))
    eps_sq = h / (n - 1) if n > 1 else None
    title = f"Kruskal-Wallis H — {dv} by {between}"

    stats_out: dict[str, Any] = {
        "test": title,
        "h": round(h, 6),
        "df": float(row.get("ddof1", n_levels - 1)),
        "p_value": round(p_val, 6),
        "epsilon_squared": round(eps_sq, 6) if eps_sq is not None else None,
        "alpha": alpha,
        "significant": bool(p_val < alpha),
        "post_hoc_method": post_hoc,
    }

    # Dunn's post-hoc (Bonferroni) when the omnibus test is significant
    if post_hoc == "dunn" and p_val < alpha and n_levels >= 2:
        try:
            mat = sp.posthoc_dunn(df, val_col=dv, group_col=between, p_adjust="bonferroni")
            levels = list(mat.index)
            ph_rows = []
            for i in range(len(levels)):
                for j in range(i + 1, len(levels)):
                    p_adj = float(mat.iloc[i, j])
                    ph_rows.append({
                        "group_a": str(levels[i]),
                        "group_b": str(levels[j]),
                        "p_adjusted": round(p_adj, 6),
                        "significant": "yes" if p_adj < alpha else "no",
                    })
            if ph_rows:
                stats_out["post_hoc"] = df_to_table(pd.DataFrame(ph_rows))
        except Exception as e:
            warnings.append(f"Dunn post-hoc failed: {e}")

    table_df = pd.DataFrame([{
        "test": title,
        "H": stats_out["h"],
        "df": stats_out["df"],
        "p_value": stats_out["p_value"],
        "epsilon_squared": stats_out["epsilon_squared"],
        "significant": "yes" if stats_out["significant"] else "no",
    }])
    table = df_to_table(table_df)

    series_by_group: dict[str, list[float]] = {}
    for grp, sub in df.groupby(between, dropna=False):
        series_by_group[str(grp)] = pd.to_numeric(sub[dv], errors="coerce").dropna().tolist()
    plots = [PlotSpec(
        type="boxplot",
        plotly=boxplot_spec(series_by_group, title=f"{dv} by {between}", y_label=dv),
    )]

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats_out, table=TableBlock(**table), plots=plots, warnings=warnings,
        meta=Meta(n=n, duration_ms=duration_ms, version=VERSION),
    )
