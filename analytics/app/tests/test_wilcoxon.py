import numpy as np


def test_wilcoxon_significant(client, auth_headers):
    rng = np.random.default_rng(2)
    base = rng.normal(10, 2, size=40)
    rows = [{"pre": float(b), "post": float(b + abs(rng.normal(3, 1)))} for b in base]
    r = client.post("/v1/wilcoxon", headers=auth_headers, json={
        "data": rows,
        "variables": {"column_a": "pre", "column_b": "post"},
        "options": {"alpha": 0.05},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["p_value"] < 0.05
    assert s["significant"] is True
    assert s["w"] is not None
    assert s["n_pairs"] == 40


def test_wilcoxon_missing_second_column(client, auth_headers):
    r = client.post("/v1/wilcoxon", headers=auth_headers, json={
        "data": [{"pre": 1.0}],
        "variables": {"column_a": "pre", "column_b": "post"},
    })
    assert r.status_code == 400
