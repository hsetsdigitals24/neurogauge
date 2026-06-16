import numpy as np


def _two_factor_data(n=300, seed=40):
    rng = np.random.default_rng(seed)
    f1 = rng.normal(0, 1, n)
    f2 = rng.normal(0, 1, n)
    rows = []
    for i in range(n):
        rows.append({
            "i1": float(0.8 * f1[i] + rng.normal(0, 0.4)),
            "i2": float(0.7 * f1[i] + rng.normal(0, 0.4)),
            "i3": float(0.9 * f1[i] + rng.normal(0, 0.4)),
            "j1": float(0.8 * f2[i] + rng.normal(0, 0.4)),
            "j2": float(0.75 * f2[i] + rng.normal(0, 0.4)),
            "j3": float(0.85 * f2[i] + rng.normal(0, 0.4)),
        })
    return rows


def test_factor_efa(client, auth_headers):
    items = ["i1", "i2", "i3", "j1", "j2", "j3"]
    r = client.post("/v1/factor", headers=auth_headers, json={
        "data": _two_factor_data(),
        "variables": {"items": items},
        "options": {"rotation": "varimax", "n_factors": "auto"},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["stats"]
    assert s["model"] == "EFA"
    assert len(s["eigenvalues"]) == len(items)
    assert s["n_factors"] >= 2  # two latent constructs
    assert len(s["loadings"]) == len(items)
    types = {p["type"] for p in body["plots"]}
    assert "scree" in types and "factor_heatmap" in types


def test_factor_fixed_n(client, auth_headers):
    items = ["i1", "i2", "i3", "j1", "j2", "j3"]
    r = client.post("/v1/factor", headers=auth_headers, json={
        "data": _two_factor_data(seed=41),
        "variables": {"items": items},
        "options": {"rotation": "none", "n_factors": 2},
    })
    assert r.status_code == 200, r.text
    assert r.json()["stats"]["n_factors"] == 2


def test_factor_too_few_items(client, auth_headers):
    r = client.post("/v1/factor", headers=auth_headers, json={
        "data": [{"a": 1, "b": 2}],
        "variables": {"items": ["a", "b"]},
    })
    assert r.status_code == 400
