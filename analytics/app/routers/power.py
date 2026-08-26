"""Sample-size & power analysis.

Unlike every other router, this one is *dataset-free*: it takes design
parameters (effect size, alpha, target power, …) and solves the missing
quantity of a power equation. Three modes:

  * solve_for="n"           → a-priori sample size (the common case)
  * solve_for="power"       → achieved/post-hoc power for a given n
  * solve_for="effect_size" → minimum detectable effect (sensitivity)

Solvers come from statsmodels (t-tests, ANOVA, chi-square, proportions) and
pingouin (correlation), both already dependencies.
"""
import math
import time

import pandas as pd
import pingouin as pg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from statsmodels.stats.power import (
    FTestAnovaPower,
    GofChisquarePower,
    NormalIndPower,
    TTestIndPower,
    TTestPower,
)

from app import VERSION
from app.core.csv_io import df_to_table
from app.deps import require_secret
from app.schemas.common import AnalysisResponse, Meta, TableBlock

router = APIRouter(tags=["power"], dependencies=[Depends(require_secret)])


class PowerRequest(BaseModel):
    test: str
    solve_for: str = "n"  # n | power | effect_size
    effect_size: float | None = None
    alpha: float = 0.05
    power: float | None = 0.8
    n: float | None = None  # per-group for two-sample tests; total otherwise
    k_groups: int | None = None  # one-way ANOVA
    df: int | None = None  # chi-square degrees of freedom
    ratio: float = 1.0  # group2 / group1 allocation (two-sample tests)
    alternative: str = "two-sided"  # two-sided | greater | less


TEST_LABELS = {
    "ttest-two": "Independent two-sample t-test",
    "ttest-paired": "Paired t-test",
    "ttest-one": "One-sample t-test",
    "anova": "One-way ANOVA",
    "correlation": "Correlation (Pearson r)",
    "chi-square": "Chi-square test",
    "proportion-two": "Two-proportion z-test",
}

# Human-friendly name of the effect-size metric each test uses, plus Cohen's
# small/medium/large benchmarks (surfaced so the researcher can sanity-check).
EFFECT = {
    "ttest-two": ("Cohen's d", (0.2, 0.5, 0.8)),
    "ttest-paired": ("Cohen's d", (0.2, 0.5, 0.8)),
    "ttest-one": ("Cohen's d", (0.2, 0.5, 0.8)),
    "anova": ("Cohen's f", (0.1, 0.25, 0.4)),
    "correlation": ("r", (0.1, 0.3, 0.5)),
    "chi-square": ("Cohen's w", (0.1, 0.3, 0.5)),
    "proportion-two": ("Cohen's h", (0.2, 0.5, 0.8)),
}

# statsmodels expects larger/smaller; the UI speaks greater/less.
_ALT = {"two-sided": "two-sided", "greater": "larger", "less": "smaller"}

# Tests where the alternative hypothesis is inherently one-tailed (F / χ²).
_OMNIBUS = {"anova", "chi-square"}


def _round(x, nd=4):
    if x is None:
        return None
    try:
        return round(float(x), nd)
    except (TypeError, ValueError):
        return None


@router.post("/power", response_model=AnalysisResponse)
def power(req: PowerRequest) -> AnalysisResponse:
    started = time.perf_counter()

    if req.test not in TEST_LABELS:
        raise HTTPException(400, f"Unknown test '{req.test}'. One of: {', '.join(TEST_LABELS)}")
    solve_for = req.solve_for
    if solve_for not in {"n", "power", "effect_size"}:
        raise HTTPException(400, "solve_for must be one of: n, power, effect_size")

    alpha = float(req.alpha)
    if not (0 < alpha < 1):
        raise HTTPException(400, "alpha must be between 0 and 1")

    # Validate the inputs that must be present for the chosen mode.
    if solve_for != "effect_size":
        if req.effect_size is None:
            raise HTTPException(400, "effect_size is required unless solving for it")
        if float(req.effect_size) <= 0:
            raise HTTPException(400, "effect_size must be > 0")
    if solve_for != "power":
        if req.power is None:
            raise HTTPException(400, "power is required unless solving for it")
        if not (0 < float(req.power) < 1):
            raise HTTPException(400, "power must be between 0 and 1 (e.g. 0.80)")
    if solve_for != "n" and (req.n is None or float(req.n) < 2):
        raise HTTPException(400, "n (>= 2) is required when solving for power or effect size")

    es = None if solve_for == "effect_size" else float(req.effect_size)
    pw = None if solve_for == "power" else float(req.power)
    alt_ui = req.alternative if req.alternative in _ALT else "two-sided"
    alt_sm = _ALT[alt_ui]

    warnings: list[str] = []

    # ── Solve per test ────────────────────────────────────────────────────
    # Each branch computes `solved` (the value of whatever was None) plus a
    # per-test view of the sample size (per_group / total) for the table.
    per_group = total = None

    try:
        if req.test in {"ttest-two", "proportion-two"}:
            Solver = TTestIndPower if req.test == "ttest-two" else NormalIndPower
            nobs1 = None if solve_for == "n" else float(req.n)  # n is per group
            solved = Solver().solve_power(
                effect_size=es, nobs1=nobs1, alpha=alpha, power=pw,
                ratio=float(req.ratio), alternative=alt_sm,
            )
            if solve_for == "n":
                g1 = math.ceil(solved)
                g2 = math.ceil(solved * float(req.ratio))
                per_group, total = (g1 if req.ratio == 1 else (g1, g2)), g1 + g2
            else:
                g1 = int(round(float(req.n)))
                total = g1 + int(round(g1 * float(req.ratio)))
                per_group = g1

        elif req.test in {"ttest-one", "ttest-paired"}:
            nobs = None if solve_for == "n" else float(req.n)
            solved = TTestPower().solve_power(
                effect_size=es, nobs=nobs, alpha=alpha, power=pw, alternative=alt_sm,
            )
            total = math.ceil(solved) if solve_for == "n" else int(round(float(req.n)))

        elif req.test == "anova":
            k = req.k_groups
            if not k or k < 2:
                raise HTTPException(400, "k_groups (>= 2) is required for ANOVA")
            nobs = None if solve_for == "n" else float(req.n)  # total N
            solved = FTestAnovaPower().solve_power(
                effect_size=es, nobs=nobs, alpha=alpha, power=pw, k_groups=k,
            )
            total = math.ceil(solved) if solve_for == "n" else int(round(float(req.n)))
            per_group = math.ceil(total / k)

        elif req.test == "correlation":
            # pingouin speaks the UI's alternative vocabulary directly.
            solved = pg.power_corr(
                r=es, n=(None if solve_for == "n" else float(req.n)),
                power=pw, alpha=alpha, alternative=alt_ui,
            )
            if solved is None or (isinstance(solved, float) and math.isnan(solved)):
                raise ValueError("no solution")
            total = math.ceil(solved) if solve_for == "n" else int(round(float(req.n)))

        elif req.test == "chi-square":
            dof = req.df if req.df and req.df >= 1 else 1
            nobs = None if solve_for == "n" else float(req.n)
            solved = GofChisquarePower().solve_power(
                effect_size=es, nobs=nobs, alpha=alpha, power=pw, n_bins=dof + 1,
            )
            total = math.ceil(solved) if solve_for == "n" else int(round(float(req.n)))

        else:  # pragma: no cover — guarded above
            raise HTTPException(400, f"Unsupported test '{req.test}'")
    except HTTPException:
        raise
    except Exception as exc:  # solver failed to converge / impossible design
        raise HTTPException(
            400,
            "Could not solve the power equation for these inputs — try a larger "
            f"effect size or a lower target power. ({exc})",
        )

    if solved is None or (isinstance(solved, float) and (math.isnan(solved) or math.isinf(solved))):
        raise HTTPException(400, "No solution for these inputs — the design is infeasible.")

    # ── Assemble the answer ──────────────────────────────────────────────
    eff_label, (small, medium, large) = EFFECT[req.test]
    resolved_es = _round(solved if solve_for == "effect_size" else es)
    resolved_power = _round(solved if solve_for == "power" else pw)

    if solve_for == "n" and total is not None and total > 100_000:
        warnings.append("Required sample exceeds 100,000 — the effect size may be unrealistically small.")
    if resolved_power is not None and solve_for != "power" and resolved_power < 0.8:
        warnings.append(f"Target power {resolved_power} is below the conventional 0.80.")
    if solve_for == "effect_size" and resolved_es is not None and resolved_es > large:
        warnings.append(
            f"Minimum detectable effect ({eff_label} = {resolved_es}) is large — this design "
            "can only detect big effects."
        )

    stats = {
        "test": TEST_LABELS[req.test],
        "solve_for": solve_for,
        "effect_size": resolved_es,
        "effect_size_metric": eff_label,
        "alpha": alpha,
        "power": resolved_power,
        "alternative": "n/a" if req.test in _OMNIBUS else alt_ui,
        "n_total": total,
        "n_per_group": per_group if isinstance(per_group, int) else None,
        "n_per_group_unequal": list(per_group) if isinstance(per_group, tuple) else None,
        "benchmarks": {"small": small, "medium": medium, "large": large},
    }

    # One-line human summary of the result.
    if solve_for == "n":
        if per_group is not None and req.test in {"ttest-two", "proportion-two", "anova"}:
            grp = per_group if isinstance(per_group, int) else " / ".join(map(str, per_group))
            headline = f"n = {total} total ({grp} per group)"
        else:
            headline = f"n = {total} total"
    elif solve_for == "power":
        headline = f"power = {resolved_power}"
    else:
        headline = f"minimum detectable {eff_label} = {resolved_es}"
    stats["result"] = headline

    table_df = pd.DataFrame([{
        "test": TEST_LABELS[req.test],
        "solving for": solve_for,
        eff_label: resolved_es,
        "alpha": alpha,
        "power": resolved_power,
        "n (total)": total,
        "n (per group)": stats["n_per_group"],
        "result": headline,
    }])
    table = df_to_table(table_df)

    duration_ms = int((time.perf_counter() - started) * 1000)
    return AnalysisResponse(
        stats=stats,
        table=TableBlock(**table),
        plots=[],
        warnings=warnings,
        # meta.n reflects the sample size in play (solved or supplied).
        meta=Meta(n=int(total or 0), duration_ms=duration_ms, version=VERSION),
    )
