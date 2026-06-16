import numpy as np


def test_modelling_gaussian(client, auth_headers):
    rng = np.random.default_rng(10)
    x = rng.normal(0, 1, size=100)
    y = 2.0 * x + rng.normal(0, 0.5, size=100)
    rows = [{"y": float(yi), "x": float(xi)} for yi, xi in zip(y, x)]
    r = client.post("/v1/modelling", headers=auth_headers, json={
        "data": rows,
        "variables": {"formula": "y ~ x", "family": "gaussian"},
        "options": {"alpha": 0.05},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["family"] == "gaussian"
    assert s["model"] == "GLM"
    coefs = {c["name"]: c for c in s["coefficients"]}
    assert "x" in coefs
    assert coefs["x"]["significant"] == "yes"
    assert coefs["x"]["p_value"] < 0.05


def test_modelling_poisson(client, auth_headers):
    rng = np.random.default_rng(11)
    x = rng.normal(0, 1, size=200)
    y = rng.poisson(np.exp(0.3 + 0.5 * x))
    rows = [{"y": int(yi), "x": float(xi)} for yi, xi in zip(y, x)]
    r = client.post("/v1/modelling", headers=auth_headers, json={
        "data": rows,
        "variables": {"formula": "y ~ x", "family": "poisson"},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["family"] == "poisson"
    assert any(c["name"] == "x" for c in s["coefficients"])


def test_modelling_missing_formula(client, auth_headers):
    r = client.post("/v1/modelling", headers=auth_headers, json={
        "data": [{"y": 1, "x": 2}],
        "variables": {"family": "gaussian"},
    })
    assert r.status_code == 400
