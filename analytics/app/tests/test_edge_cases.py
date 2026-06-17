"""Service-wide edge-case suite.

Every analysis endpoint is fired with degenerate-but-well-formed input — empty data,
all-null / non-numeric value columns, single-level grouping factors, and samples that are
too small. The contract is: **never return a 500**. Bad input must come back as a clean
400 (or a 200 with a warning for endpoints that degrade gracefully, e.g. descriptive),
never an unhandled server error. This locks in the guards added in app/core/guards.py.
"""
import pytest


def _rows_allnull(value_key: str, n: int = 40, **extra):
    return [{value_key: None, **{k: (i % 2) for k in extra}} for i in range(n)]


# (id, path, payload) — degenerate input that must NOT produce a 500.
DEGENERATE: list[tuple[str, str, dict]] = [
    # ── empty data ─────────────────────────────────────────────────────────────
    ("descriptive_empty", "/v1/descriptive", {"data": [], "variables": {"columns": ["x"]}}),
    ("normality_empty", "/v1/normality", {"data": [], "variables": {"column": "x"}}),
    ("ttest_empty", "/v1/ttest", {"data": [], "variables": {"kind": "one_sample", "column": "x"}}),
    ("correlation_empty", "/v1/correlation", {"data": [], "variables": {"columns": ["a", "b"]}}),
    ("chi_square_empty", "/v1/chi-square", {"data": [], "variables": {"row": "r", "column": "c"}}),
    ("anova_empty", "/v1/anova", {"data": [], "variables": {"dv": "y", "between": "g"}}),
    ("mwu_empty", "/v1/mann-whitney", {"data": [], "variables": {"column": "x", "group_by": "g"}}),
    ("wilcoxon_empty", "/v1/wilcoxon", {"data": [], "variables": {"column_a": "a", "column_b": "b"}}),
    ("kruskal_empty", "/v1/kruskal-wallis", {"data": [], "variables": {"dv": "y", "between": "g"}}),
    ("friedman_empty", "/v1/friedman", {"data": [], "variables": {"dv": "y", "within": "w", "subject": "s"}}),
    ("linreg_empty", "/v1/regression/linear", {"data": [], "variables": {"dv": "y", "predictors": ["x"]}}),
    ("logreg_empty", "/v1/regression/logistic", {"data": [], "variables": {"dv": "y", "predictors": ["x"]}}),
    ("reliability_empty", "/v1/reliability", {"data": [], "variables": {"items": ["a", "b"]}}),
    ("roc_empty", "/v1/roc", {"data": [], "variables": {"truth": "t", "score": "s"}}),
    ("growth_empty", "/v1/growth", {"data": [], "variables": {"dv": "y", "time": "t"}}),
    ("modelling_empty", "/v1/modelling", {"data": [], "variables": {"formula": "y ~ x", "family": "gaussian"}}),
    ("factor_empty", "/v1/factor", {"data": [], "variables": {"items": ["a", "b", "c"]}}),
    ("irt_empty", "/v1/irt", {"data": [], "variables": {"items": ["a", "b"]}}),
    ("sem_empty", "/v1/sem", {"data": [], "variables": {"model": "F =~ a + b + c"}}),

    # ── all-null value column ──────────────────────────────────────────────────
    ("anova_allnull_within", "/v1/anova",
     {"data": [{"y": float(i), "c": None, "s": i % 5} for i in range(40)],
      "variables": {"dv": "y", "within": "c", "subject": "s"}}),
    ("anova_allnull_dv", "/v1/anova",
     {"data": [{"y": None, "g": "a" if i % 2 else "b"} for i in range(40)],
      "variables": {"dv": "y", "between": "g"}}),
    ("ttest_allnull_dv", "/v1/ttest",
     {"data": [{"x": None, "g": "a" if i % 2 else "b"} for i in range(20)],
      "variables": {"kind": "independent", "column": "x", "group_by": "g"}}),
    ("kruskal_allnull_dv", "/v1/kruskal-wallis",
     {"data": [{"y": None, "g": ["a", "b", "c"][i % 3]} for i in range(30)],
      "variables": {"dv": "y", "between": "g"}}),
    ("correlation_allnull", "/v1/correlation",
     {"data": [{"a": None, "b": None} for _ in range(20)], "variables": {"columns": ["a", "b"]}}),
    ("reliability_allnull", "/v1/reliability",
     {"data": [{"a": None, "b": None, "c": None} for _ in range(20)], "variables": {"items": ["a", "b", "c"]}}),
    ("factor_allnull", "/v1/factor",
     {"data": [{"a": None, "b": None, "c": None} for _ in range(20)], "variables": {"items": ["a", "b", "c"]}}),

    # ── non-numeric text where numbers are expected ────────────────────────────
    ("normality_text", "/v1/normality",
     {"data": [{"x": "abc"} for _ in range(20)], "variables": {"column": "x"}}),
    ("descriptive_text", "/v1/descriptive",
     {"data": [{"x": "abc"} for _ in range(20)], "variables": {"columns": ["x"]}}),
    ("ttest_text", "/v1/ttest",
     {"data": [{"x": "xx", "g": "a" if i % 2 else "b"} for i in range(20)],
      "variables": {"kind": "independent", "column": "x", "group_by": "g"}}),

    # ── single group / single level / constant column ──────────────────────────
    ("anova_single_level", "/v1/anova",
     {"data": [{"y": float(i), "g": "only"} for i in range(20)], "variables": {"dv": "y", "between": "g"}}),
    ("mwu_one_group", "/v1/mann-whitney",
     {"data": [{"x": float(i), "g": "a"} for i in range(20)], "variables": {"column": "x", "group_by": "g"}}),
    ("kruskal_single_level", "/v1/kruskal-wallis",
     {"data": [{"y": float(i), "g": "only"} for i in range(20)], "variables": {"dv": "y", "between": "g"}}),
    ("friedman_single_level", "/v1/friedman",
     {"data": [{"y": float(i), "w": "only", "s": i} for i in range(20)],
      "variables": {"dv": "y", "within": "w", "subject": "s"}}),
    ("chi_square_single_cat", "/v1/chi-square",
     {"data": [{"r": "x", "c": "y"} for _ in range(20)], "variables": {"row": "r", "column": "c"}}),
    ("factor_constant", "/v1/factor",
     {"data": [{"a": 1.0, "b": float(i), "c": float(i)} for i in range(20)],
      "variables": {"items": ["a", "b", "c"]}}),

    # ── one class only (ROC / logistic need both) ──────────────────────────────
    ("roc_one_class", "/v1/roc",
     {"data": [{"t": 1, "s": float(i)} for i in range(20)], "variables": {"truth": "t", "score": "s"}}),
    ("logreg_one_class", "/v1/regression/logistic",
     {"data": [{"y": 1, "x": float(i)} for i in range(20)], "variables": {"dv": "y", "predictors": ["x"]}}),

    # ── samples too small ──────────────────────────────────────────────────────
    ("wilcoxon_tiny", "/v1/wilcoxon",
     {"data": [{"a": 1.0, "b": 2.0}], "variables": {"column_a": "a", "column_b": "b"}}),
    ("ttest_tiny", "/v1/ttest",
     {"data": [{"x": 1.0}], "variables": {"kind": "one_sample", "column": "x", "mu": 0}}),
    ("linreg_tiny", "/v1/regression/linear",
     {"data": [{"y": 1.0, "x": 2.0}], "variables": {"dv": "y", "predictors": ["x"]}}),
    ("irt_tiny", "/v1/irt",
     {"data": [{"a": 1, "b": 0} for _ in range(3)], "variables": {"items": ["a", "b"]}}),
    ("sem_tiny", "/v1/sem",
     {"data": [{"a": 1.0, "b": 1.0, "c": 1.0} for _ in range(3)], "variables": {"model": "F =~ a + b + c"}}),

    # ── missing required columns ───────────────────────────────────────────────
    ("anova_missing_col", "/v1/anova",
     {"data": [{"y": float(i)} for i in range(20)], "variables": {"dv": "y", "between": "nope"}}),
    ("correlation_missing_col", "/v1/correlation",
     {"data": [{"a": float(i)} for i in range(20)], "variables": {"columns": ["a", "nope"]}}),
]


@pytest.mark.parametrize("path,payload", [(p, pl) for _id, p, pl in DEGENERATE],
                         ids=[i for i, _p, _pl in DEGENERATE])
def test_degenerate_input_never_500(client, auth_headers, path, payload):
    r = client.post(path, headers=auth_headers, json=payload)
    assert r.status_code != 500, f"{path} returned 500 on degenerate input: {r.text}"
    # Should be a clean client error or a graceful success — nothing else.
    assert r.status_code in (200, 400), f"{path} unexpected status {r.status_code}: {r.text}"


# Inputs that are unambiguously invalid and must be rejected with 400 (not silently 200).
MUST_400: list[tuple[str, str, dict]] = [
    ("anova_empty_400", "/v1/anova", {"data": [], "variables": {"dv": "y", "between": "g"}}),
    ("anova_allnull_within_400", "/v1/anova",
     {"data": [{"y": float(i), "c": None, "s": i % 5} for i in range(40)],
      "variables": {"dv": "y", "within": "c", "subject": "s"}}),
    ("anova_single_level_400", "/v1/anova",
     {"data": [{"y": float(i), "g": "only"} for i in range(20)], "variables": {"dv": "y", "between": "g"}}),
    ("roc_one_class_400", "/v1/roc",
     {"data": [{"t": 1, "s": float(i)} for i in range(20)], "variables": {"truth": "t", "score": "s"}}),
    ("mwu_one_group_400", "/v1/mann-whitney",
     {"data": [{"x": float(i), "g": "a"} for i in range(20)], "variables": {"column": "x", "group_by": "g"}}),
    ("missing_dv_400", "/v1/anova", {"data": [{"y": 1, "g": "a"}], "variables": {"between": "g"}}),
]


@pytest.mark.parametrize("path,payload", [(p, pl) for _id, p, pl in MUST_400],
                         ids=[i for i, _p, _pl in MUST_400])
def test_invalid_input_returns_400(client, auth_headers, path, payload):
    r = client.post(path, headers=auth_headers, json=payload)
    assert r.status_code == 400, f"{path} should be 400, got {r.status_code}: {r.text}"
