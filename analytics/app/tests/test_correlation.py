import numpy as np


def test_strong_positive_pearson(client, auth_headers):
    rng = np.random.default_rng(0)
    x = rng.normal(0, 1, size=100)
    y = 2 * x + rng.normal(0, 0.5, size=100)
    rows = [{"x": float(a), "y": float(b)} for a, b in zip(x, y)]
    r = client.post("/v1/correlation", headers=auth_headers, json={
        "data": rows, "variables": {"columns": ["x", "y"]}, "options": {"method": "pearson"},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    pair = body["stats"]["pairs"]["x ↔ y"]
    assert pair["r"] > 0.9
    assert pair["p_value"] < 0.001
    assert any(p["type"] == "scatter" for p in body["plots"])


def test_spearman_with_three_vars_emits_heatmap(client, auth_headers):
    rng = np.random.default_rng(0)
    rows = [{"a": float(v), "b": float(2 * v + rng.normal()), "c": float(rng.normal())}
            for v in rng.normal(0, 1, size=60)]
    r = client.post("/v1/correlation", headers=auth_headers, json={
        "data": rows, "variables": {"columns": ["a", "b", "c"]},
        "options": {"method": "spearman"},
    })
    assert r.status_code == 200
    body = r.json()
    assert any(p["type"] == "corr_heatmap" for p in body["plots"])
    assert body["stats"]["method"] == "spearman"


def test_too_few_columns(client, auth_headers):
    r = client.post("/v1/correlation", headers=auth_headers, json={
        "data": [{"x": 1}], "variables": {"columns": ["x"]},
    })
    assert r.status_code == 400
