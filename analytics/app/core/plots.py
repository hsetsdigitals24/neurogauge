from typing import Any
import numpy as np
from scipy import stats


def histogram_spec(values: list[float], title: str = "Distribution", bins: int = 30) -> dict[str, Any]:
    arr = np.asarray(values, dtype=float)
    arr = arr[~np.isnan(arr)]
    traces: list[dict[str, Any]] = [
        {
            "type": "histogram",
            "x": arr.tolist(),
            "nbinsx": bins,
            "name": "count",
            "marker": {"color": "#6366f1"},
            "opacity": 0.85,
        }
    ]
    if arr.size >= 2 and np.std(arr) > 0:
        kde = stats.gaussian_kde(arr)
        xs = np.linspace(arr.min(), arr.max(), 200)
        # Scale KDE to histogram counts so it overlays sensibly.
        bin_width = (arr.max() - arr.min()) / bins if bins else 1
        ys = kde(xs) * arr.size * bin_width
        traces.append(
            {
                "type": "scatter",
                "mode": "lines",
                "x": xs.tolist(),
                "y": ys.tolist(),
                "name": "density",
                "line": {"color": "#ef4444", "width": 2},
                "yaxis": "y",
            }
        )
    return {
        "data": traces,
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": "value"}},
            "yaxis": {"title": {"text": "count"}},
            "bargap": 0.04,
        },
    }


def boxplot_spec(
    series_by_group: dict[str, list[float]],
    title: str,
    y_label: str,
) -> dict[str, Any]:
    """One Plotly box trace per group. Pass {"": values} for ungrouped."""
    palette = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"]
    traces: list[dict[str, Any]] = []
    for i, (label, values) in enumerate(series_by_group.items()):
        arr = np.asarray(values, dtype=float)
        arr = arr[~np.isnan(arr)]
        traces.append({
            "type": "box",
            "y": arr.tolist(),
            "name": label or y_label,
            "boxpoints": "outliers",
            "marker": {"color": palette[i % len(palette)]},
            "line": {"width": 1.5},
        })
    return {
        "data": traces,
        "layout": {
            "title": {"text": title},
            "yaxis": {"title": {"text": y_label}},
            "xaxis": {"title": {"text": "group"} if len(series_by_group) > 1 else {"text": ""}},
            "showlegend": False,
        },
    }


def mean_ci_bar_spec(
    rows: list[dict[str, Any]],
    title: str,
    y_label: str,
) -> dict[str, Any]:
    """Bar chart of means with asymmetric error bars from ci_low / ci_high.

    Each row: {"group": str, "mean": float, "ci_low": float, "ci_high": float, "n": int}.
    """
    labels = [str(r.get("group") or y_label) for r in rows]
    means = [r["mean"] for r in rows]
    err_plus = [r["ci_high"] - r["mean"] for r in rows]
    err_minus = [r["mean"] - r["ci_low"] for r in rows]
    counts = [r.get("n", 0) for r in rows]

    return {
        "data": [
            {
                "type": "bar",
                "x": labels,
                "y": means,
                "marker": {"color": "#6366f1"},
                "error_y": {
                    "type": "data",
                    "symmetric": False,
                    "array": err_plus,
                    "arrayminus": err_minus,
                    "color": "#ef4444",
                    "thickness": 1.5,
                    "width": 6,
                },
                "text": [f"n={n}" for n in counts],
                "textposition": "outside",
                "hovertemplate": "%{x}<br>mean=%{y:.3f}<extra></extra>",
            }
        ],
        "layout": {
            "title": {"text": title},
            "yaxis": {"title": {"text": y_label}},
            "xaxis": {"title": {"text": "group"} if len(rows) > 1 else {"text": ""}},
            "showlegend": False,
        },
    }


def scatter_spec(
    x: list[float],
    y: list[float],
    x_label: str,
    y_label: str,
    title: str,
    fit: str | None = "ols",
) -> dict[str, Any]:
    """Scatter with optional OLS regression line."""
    xs = np.asarray(x, dtype=float)
    ys = np.asarray(y, dtype=float)
    mask = ~(np.isnan(xs) | np.isnan(ys))
    xs, ys = xs[mask], ys[mask]

    traces: list[dict[str, Any]] = [{
        "type": "scatter",
        "mode": "markers",
        "x": xs.tolist(),
        "y": ys.tolist(),
        "name": "observations",
        "marker": {"color": "#6366f1", "size": 6, "opacity": 0.75},
    }]
    if fit == "ols" and xs.size >= 2 and np.std(xs) > 0:
        slope, intercept = np.polyfit(xs, ys, 1)
        line_x = [float(xs.min()), float(xs.max())]
        line_y = [slope * x + intercept for x in line_x]
        traces.append({
            "type": "scatter",
            "mode": "lines",
            "x": line_x,
            "y": line_y,
            "name": "OLS fit",
            "line": {"color": "#ef4444", "width": 2},
        })

    return {
        "data": traces,
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": x_label}},
            "yaxis": {"title": {"text": y_label}},
        },
    }


def heatmap_spec(
    matrix: list[list[float]],
    x_labels: list[str],
    y_labels: list[str],
    title: str,
    zmin: float | None = None,
    zmax: float | None = None,
    annotation_fmt: str = ".2f",
) -> dict[str, Any]:
    """Annotated heatmap. Used for correlation matrices and contingency tables."""
    annotations: list[dict[str, Any]] = []
    for i, row in enumerate(matrix):
        for j, v in enumerate(row):
            if v is None or (isinstance(v, float) and np.isnan(v)):
                text = ""
            else:
                text = f"{v:{annotation_fmt}}"
            annotations.append({
                "x": x_labels[j],
                "y": y_labels[i],
                "text": text,
                "showarrow": False,
                "font": {"color": "#111827", "size": 11},
            })
    trace: dict[str, Any] = {
        "type": "heatmap",
        "x": x_labels,
        "y": y_labels,
        "z": matrix,
        "colorscale": [[0, "#ef4444"], [0.5, "#ffffff"], [1, "#6366f1"]],
        "showscale": True,
    }
    if zmin is not None:
        trace["zmin"] = zmin
    if zmax is not None:
        trace["zmax"] = zmax
    return {
        "data": [trace],
        "layout": {
            "title": {"text": title},
            "xaxis": {"side": "bottom"},
            "yaxis": {"autorange": "reversed"},
            "annotations": annotations,
        },
    }


def residuals_spec(
    fitted: list[float],
    residuals: list[float],
    title: str = "Residuals vs fitted",
) -> dict[str, Any]:
    """Standard residuals-vs-fitted diagnostic with a zero reference line."""
    fitted_arr = np.asarray(fitted, dtype=float)
    if fitted_arr.size == 0:
        x_range = [0.0, 1.0]
    else:
        x_range = [float(fitted_arr.min()), float(fitted_arr.max())]
    return {
        "data": [
            {
                "type": "scatter",
                "mode": "markers",
                "x": fitted,
                "y": residuals,
                "name": "residual",
                "marker": {"color": "#6366f1", "size": 6, "opacity": 0.75},
            },
            {
                "type": "scatter",
                "mode": "lines",
                "x": x_range,
                "y": [0, 0],
                "name": "zero",
                "line": {"color": "#ef4444", "width": 1.5, "dash": "dash"},
            },
        ],
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": "fitted"}},
            "yaxis": {"title": {"text": "residual"}},
            "showlegend": False,
        },
    }


def roc_curve_spec(
    fpr: list[float],
    tpr: list[float],
    auc: float,
    title: str = "ROC curve",
) -> dict[str, Any]:
    """ROC curve with diagonal reference."""
    return {
        "data": [
            {
                "type": "scatter",
                "mode": "lines",
                "x": fpr,
                "y": tpr,
                "name": f"ROC (AUC={auc:.3f})",
                "line": {"color": "#6366f1", "width": 2.5},
                "fill": "tozeroy",
                "fillcolor": "rgba(99, 102, 241, 0.15)",
            },
            {
                "type": "scatter",
                "mode": "lines",
                "x": [0, 1],
                "y": [0, 1],
                "name": "chance",
                "line": {"color": "#9ca3af", "width": 1, "dash": "dash"},
            },
        ],
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": "False positive rate"}, "range": [0, 1]},
            "yaxis": {"title": {"text": "True positive rate"}, "range": [0, 1.05]},
        },
    }


def coefficient_forest_spec(
    rows: list[dict[str, Any]],
    title: str,
    x_label: str = "coefficient",
) -> dict[str, Any]:
    """Forest plot of coefficients with CI error bars.

    Each row: {"name": str, "estimate": float, "ci_low": float, "ci_high": float}.
    """
    names = [r["name"] for r in rows]
    est = [r["estimate"] for r in rows]
    err_plus = [r["ci_high"] - r["estimate"] for r in rows]
    err_minus = [r["estimate"] - r["ci_low"] for r in rows]
    return {
        "data": [{
            "type": "scatter",
            "mode": "markers",
            "x": est,
            "y": names,
            "error_x": {
                "type": "data",
                "symmetric": False,
                "array": err_plus,
                "arrayminus": err_minus,
                "color": "#6366f1",
                "thickness": 1.5,
                "width": 6,
            },
            "marker": {"color": "#6366f1", "size": 9, "symbol": "diamond"},
        }],
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": x_label}, "zeroline": True, "zerolinecolor": "#ef4444"},
            "yaxis": {"automargin": True},
            "showlegend": False,
        },
    }


def qq_plot_spec(values: list[float], title: str = "Normal Q–Q plot") -> dict[str, Any]:
    arr = np.asarray(values, dtype=float)
    arr = arr[~np.isnan(arr)]
    if arr.size < 2:
        return {"data": [], "layout": {"title": {"text": title}}}

    (osm, osr), (slope, intercept, _) = stats.probplot(arr, dist="norm", fit=True)
    line_x = [float(osm.min()), float(osm.max())]
    line_y = [slope * x + intercept for x in line_x]

    return {
        "data": [
            {
                "type": "scatter",
                "mode": "markers",
                "x": osm.tolist(),
                "y": osr.tolist(),
                "name": "sample",
                "marker": {"color": "#6366f1", "size": 6},
            },
            {
                "type": "scatter",
                "mode": "lines",
                "x": line_x,
                "y": line_y,
                "name": "reference",
                "line": {"color": "#ef4444", "width": 2, "dash": "dash"},
            },
        ],
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": "theoretical quantiles"}},
            "yaxis": {"title": {"text": "sample quantiles"}},
        },
    }
