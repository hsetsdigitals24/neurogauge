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


def confusion_matrix_spec(
    tp: int,
    tn: int,
    fp: int,
    fn: int,
    labels: tuple[str, str] = ("Negative", "Positive"),
    title: str = "Confusion matrix",
) -> dict[str, Any]:
    """2x2 confusion matrix as an annotated heatmap.

    Rows = actual, columns = predicted. z is [[TN, FP], [FN, TP]].
    """
    neg, pos = labels
    z = [[tn, fp], [fn, tp]]
    x_labels = [f"Pred {neg}", f"Pred {pos}"]
    y_labels = [f"Actual {neg}", f"Actual {pos}"]
    annotations: list[dict[str, Any]] = []
    for i, row in enumerate(z):
        for j, v in enumerate(row):
            annotations.append({
                "x": x_labels[j],
                "y": y_labels[i],
                "text": str(int(v)),
                "showarrow": False,
                "font": {"color": "#111827", "size": 16},
            })
    return {
        "data": [{
            "type": "heatmap",
            "x": x_labels,
            "y": y_labels,
            "z": z,
            "colorscale": [[0, "#ffffff"], [1, "#6366f1"]],
            "showscale": True,
        }],
        "layout": {
            "title": {"text": title},
            "xaxis": {"side": "bottom"},
            "yaxis": {"autorange": "reversed"},
            "annotations": annotations,
        },
    }


def pie_spec(labels: list[str], values: list[float], title: str = "Distribution") -> dict[str, Any]:
    """Pie chart of category frequencies."""
    palette = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"]
    return {
        "data": [{
            "type": "pie",
            "labels": labels,
            "values": values,
            "textinfo": "label+percent",
            "hovertemplate": "%{label}<br>%{value} (%{percent})<extra></extra>",
            "marker": {"colors": [palette[i % len(palette)] for i in range(len(labels))]},
        }],
        "layout": {
            "title": {"text": title},
            "margin": {"l": 40, "r": 40, "t": 50, "b": 40},
        },
    }


def radar_spec(
    categories: list[str],
    series_by_group: dict[str, list[float]],
    title: str = "Profile",
) -> dict[str, Any]:
    """Radar / spider chart. One scatterpolar trace per group over the shared categories."""
    palette = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"]
    traces: list[dict[str, Any]] = []
    for i, (label, vals) in enumerate(series_by_group.items()):
        closed_theta = categories + categories[:1]
        closed_r = list(vals) + list(vals[:1])
        color = palette[i % len(palette)]
        traces.append({
            "type": "scatterpolar",
            "r": closed_r,
            "theta": closed_theta,
            "name": label,
            "fill": "toself",
            "line": {"color": color},
            "opacity": 0.7,
        })
    return {
        "data": traces,
        "layout": {
            "title": {"text": title},
            "polar": {"radialaxis": {"visible": True}},
            "showlegend": len(series_by_group) > 1,
            "margin": {"l": 60, "r": 60, "t": 60, "b": 40},
        },
    }


def line_trend_spec(
    x_labels: list[str],
    series_by_group: dict[str, dict[str, list[float]]],
    title: str,
    y_label: str,
) -> dict[str, Any]:
    """Longitudinal trend / growth curve. mean ± CI line per group over ordered x.

    series_by_group: {group_label: {"mean": [...], "ci_low": [...], "ci_high": [...]}}.
    """
    palette = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"]
    traces: list[dict[str, Any]] = []
    for i, (label, s) in enumerate(series_by_group.items()):
        color = palette[i % len(palette)]
        means = s["mean"]
        err_plus = [hi - m for hi, m in zip(s["ci_high"], means)]
        err_minus = [m - lo for lo, m in zip(s["ci_low"], means)]
        traces.append({
            "type": "scatter",
            "mode": "lines+markers",
            "x": x_labels,
            "y": means,
            "name": label or y_label,
            "line": {"color": color, "width": 2},
            "marker": {"color": color, "size": 7},
            "error_y": {
                "type": "data",
                "symmetric": False,
                "array": err_plus,
                "arrayminus": err_minus,
                "color": color,
                "thickness": 1,
                "width": 5,
            },
        })
    return {
        "data": traces,
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": "time"}},
            "yaxis": {"title": {"text": y_label}},
            "showlegend": len(series_by_group) > 1,
        },
    }


def scree_spec(eigenvalues: list[float], title: str = "Scree plot") -> dict[str, Any]:
    """Scree plot of eigenvalues with a Kaiser = 1.0 reference line."""
    factors = list(range(1, len(eigenvalues) + 1))
    return {
        "data": [
            {
                "type": "scatter",
                "mode": "lines+markers",
                "x": factors,
                "y": eigenvalues,
                "name": "eigenvalue",
                "line": {"color": "#6366f1", "width": 2},
                "marker": {"color": "#6366f1", "size": 8},
            },
            {
                "type": "scatter",
                "mode": "lines",
                "x": [factors[0], factors[-1]] if factors else [1, 1],
                "y": [1.0, 1.0],
                "name": "Kaiser (=1)",
                "line": {"color": "#ef4444", "width": 1.5, "dash": "dash"},
            },
        ],
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": "factor / component"}, "dtick": 1},
            "yaxis": {"title": {"text": "eigenvalue"}},
            "showlegend": True,
        },
    }


def icc_spec(
    theta: list[float],
    item_curves: dict[str, list[float]],
    title: str = "Item characteristic curves",
) -> dict[str, Any]:
    """IRT item characteristic curves: P(correct | θ) for each item over the θ grid."""
    palette = ["#6366f1", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"]
    traces: list[dict[str, Any]] = []
    for i, (name, probs) in enumerate(item_curves.items()):
        traces.append({
            "type": "scatter",
            "mode": "lines",
            "x": theta,
            "y": probs,
            "name": name,
            "line": {"color": palette[i % len(palette)], "width": 2},
        })
    return {
        "data": traces,
        "layout": {
            "title": {"text": title},
            "xaxis": {"title": {"text": "ability (θ)"}},
            "yaxis": {"title": {"text": "P(correct)"}, "range": [0, 1]},
            "showlegend": True,
        },
    }


def path_diagram_spec(
    coef_rows: list[dict[str, Any]],
    title: str = "Path diagram",
) -> dict[str, Any]:
    """SEM/CFA path diagram built from semopy coefficient rows.

    Each row: {"lval", "op", "rval", "estimate", ...}. Latents are positioned in a centre
    column, observed variables on the outer columns; edges are drawn as arrow annotations
    labelled with the (standardised) estimate. Variance rows ("~~") are skipped.
    """
    # Edges: loadings (indicator ~ Factor) and structural regressions (y ~ x). Skip ~~.
    edges = [r for r in coef_rows if r.get("op") in {"~", "=~"}]
    # Identify latent vs observed: latents are factors that load on indicators.
    latents: set[str] = set()
    for r in edges:
        if r.get("op") == "=~":
            latents.add(str(r["lval"]))
        elif r.get("op") == "~":
            # indicator ~ Factor (semopy loadings) → rval is the latent
            latents.add(str(r["rval"]))
    # Refine: a node is latent only if it never appears as an indicator's lval target
    indicators = {str(r["lval"]) for r in edges if str(r.get("rval")) in latents}
    latents -= indicators

    nodes = []
    for r in edges:
        nodes.extend([str(r["lval"]), str(r["rval"])])
    nodes = list(dict.fromkeys(nodes))
    obs = [n for n in nodes if n not in latents]

    pos: dict[str, tuple[float, float]] = {}
    if latents:
        lat_list = list(latents)
        for i, n in enumerate(lat_list):
            pos[n] = (0.5, 1.0 - (i + 1) / (len(lat_list) + 1))
        for i, n in enumerate(obs):
            pos[n] = (0.05 if i % 2 == 0 else 0.95, 1.0 - (i + 1) / (len(obs) + 1))
    else:
        # purely structural model: lay observed nodes on a circle
        import math
        for i, n in enumerate(nodes):
            ang = 2 * math.pi * i / max(1, len(nodes))
            pos[n] = (0.5 + 0.4 * math.cos(ang), 0.5 + 0.4 * math.sin(ang))

    node_x = [pos[n][0] for n in nodes]
    node_y = [pos[n][1] for n in nodes]
    node_color = ["#6366f1" if n in latents else "#10b981" for n in nodes]
    node_symbol = ["circle" if n in latents else "square" for n in nodes]

    annotations: list[dict[str, Any]] = []
    for r in edges:
        src = str(r["rval"])
        dst = str(r["lval"])
        if src not in pos or dst not in pos:
            continue
        est = r.get("estimate")
        annotations.append({
            "x": pos[dst][0], "y": pos[dst][1],
            "ax": pos[src][0], "ay": pos[src][1],
            "xref": "x", "yref": "y", "axref": "x", "ayref": "y",
            "showarrow": True, "arrowhead": 3, "arrowsize": 1.2,
            "arrowwidth": 1.5, "arrowcolor": "#6b7280",
            "text": "" if est is None else f"{est:.2f}",
            "font": {"size": 10, "color": "#374151"},
            "standoff": 12, "startstandoff": 12,
        })
    # Node labels
    for n in nodes:
        annotations.append({
            "x": pos[n][0], "y": pos[n][1], "xref": "x", "yref": "y",
            "text": f"<b>{n}</b>", "showarrow": False,
            "font": {"size": 11, "color": "#111827"},
            "yshift": 18,
        })

    return {
        "data": [{
            "type": "scatter",
            "mode": "markers",
            "x": node_x,
            "y": node_y,
            "marker": {"color": node_color, "size": 26, "symbol": node_symbol,
                       "line": {"color": "#374151", "width": 1}},
            "hovertext": nodes,
            "hoverinfo": "text",
        }],
        "layout": {
            "title": {"text": title},
            "xaxis": {"visible": False, "range": [-0.1, 1.1]},
            "yaxis": {"visible": False, "range": [-0.1, 1.1]},
            "annotations": annotations,
            "showlegend": False,
            "margin": {"l": 30, "r": 30, "t": 50, "b": 30},
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
