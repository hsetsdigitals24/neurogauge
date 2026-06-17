"""Shared input guards so analyses fail with a clean 400, never an opaque 500.

Real-world datasets contain empty/all-null columns, non-numeric text where numbers
are expected, and single-level grouping factors. The underlying stats libraries
(pingouin, scipy, statsmodels, semopy, sklearn, girth) raise assorted exceptions on
such input; left unhandled they surface as HTTP 500. These helpers convert those
cases into HTTPException(400) with a readable message.
"""
from contextlib import contextmanager
from typing import Iterable

import pandas as pd
from fastapi import HTTPException


def ensure_columns(df: pd.DataFrame, cols: Iterable[str | None]) -> None:
    """400 if any required column is missing from the frame."""
    missing = [c for c in cols if c and c not in df.columns]
    if missing:
        raise HTTPException(400, f"columns not found: {missing}")


def coerce_numeric(df: pd.DataFrame, cols: Iterable[str]) -> pd.DataFrame:
    """Return a copy with the given columns coerced to numeric (non-numeric -> NaN)."""
    out = df.copy()
    for c in cols:
        out[c] = pd.to_numeric(out[c], errors="coerce")
    return out


def require_rows(df: pd.DataFrame, what: str = "rows") -> pd.DataFrame:
    """400 if the frame is empty (e.g. nothing left after dropping missing values)."""
    if df is None or len(df) == 0:
        raise HTTPException(400, f"no {what} remain after dropping missing/invalid values")
    return df


def require_levels(df: pd.DataFrame, col: str, minimum: int = 2) -> None:
    """400 if a grouping factor has fewer than `minimum` distinct levels."""
    levels = int(df[col].nunique(dropna=True))
    if levels < minimum:
        raise HTTPException(
            400, f"factor '{col}' has {levels} level(s) after dropping missing values — need at least {minimum}"
        )


@contextmanager
def compute_guard(what: str = "analysis"):
    """Turn an unexpected stats-library exception into a clean 400 instead of a 500."""
    try:
        yield
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"{what} could not be computed: {exc}")
