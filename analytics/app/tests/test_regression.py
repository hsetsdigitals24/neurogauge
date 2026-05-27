import numpy as np


def test_linear_regression_recovers_slope(client, auth_headers):
    rng = np.random.default_rng(0)
    x = rng.normal(0, 1, size=200)
    y = 1.5 + 2.0 * x + rng.normal(0, 0.5, size=200)
    rows = [{"y": float(a), "x": float(b)} for a, b in zip(y, x)]
    r = client.post("/v1/regression/linear", headers=auth_headers, json={
        "data": rows, "variables": {"dv": "y", "predictors": ["x"]},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["stats"]
    assert s["r_squared"] > 0.9
    coefs = {c["name"]: c for c in s["coefficients"]}
    assert abs(coefs["x"]["estimate"] - 2.0) < 0.1
    assert coefs["x"]["p_value"] < 1e-10
    plot_types = [p["type"] for p in body["plots"]]
    assert "residuals" in plot_types
    assert "coefficients" in plot_types


def test_linear_regression_multiple_predictors_with_categorical(client, auth_headers):
    rng = np.random.default_rng(1)
    n = 150
    x1 = rng.normal(0, 1, size=n)
    grp = rng.choice(["A", "B", "C"], size=n)
    grp_effect = {"A": 0.0, "B": 2.0, "C": -1.0}
    y = 0.5 + 0.7 * x1 + np.array([grp_effect[g] for g in grp]) + rng.normal(0, 0.3, size=n)
    rows = [{"y": float(a), "x1": float(b), "g": str(c)} for a, b, c in zip(y, x1, grp)]
    r = client.post("/v1/regression/linear", headers=auth_headers, json={
        "data": rows, "variables": {"dv": "y", "predictors": ["x1", "g"]},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["adj_r_squared"] > 0.85
    names = [c["name"] for c in s["coefficients"]]
    # Dummies for the categorical (one level dropped)
    assert any(n.startswith("g_") for n in names)


def test_logistic_regression(client, auth_headers):
    rng = np.random.default_rng(0)
    n = 400
    x = rng.normal(0, 1, size=n)
    p = 1 / (1 + np.exp(-(0.3 + 1.4 * x)))
    y = (rng.uniform(0, 1, size=n) < p).astype(int)
    rows = [{"y": int(a), "x": float(b)} for a, b in zip(y, x)]
    r = client.post("/v1/regression/logistic", headers=auth_headers, json={
        "data": rows, "variables": {"dv": "y", "predictors": ["x"]},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["pseudo_r_squared"] > 0.1
    coefs = {c["name"]: c for c in s["coefficients"]}
    assert coefs["x"]["odds_ratio"] > 2.0
    assert coefs["x"]["p_value"] < 1e-10
    assert 0 < s["accuracy_at_0.5"] <= 1
