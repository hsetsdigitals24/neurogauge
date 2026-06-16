import numpy as np


def test_mann_whitney_significant(client, auth_headers):
    rng = np.random.default_rng(1)
    rows = (
        [{"x": float(v), "g": "A"} for v in rng.exponential(scale=1.0, size=40)]
        + [{"x": float(v), "g": "B"} for v in rng.exponential(scale=3.0, size=40)]
    )
    r = client.post("/v1/mann-whitney", headers=auth_headers, json={
        "data": rows,
        "variables": {"column": "x", "group_by": "g"},
        "options": {"alpha": 0.05},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["p_value"] < 0.05
    assert s["significant"] is True
    assert s["u"] is not None
    assert s["rank_biserial_r"] is not None
    assert s["n1"] == 40 and s["n2"] == 40


def test_mann_whitney_missing_column(client, auth_headers):
    r = client.post("/v1/mann-whitney", headers=auth_headers, json={
        "data": [{"x": 1, "g": "A"}],
        "variables": {"column": "nope", "group_by": "g"},
    })
    assert r.status_code == 400


def test_mann_whitney_wrong_group_count(client, auth_headers):
    rows = (
        [{"x": 1.0, "g": "A"}, {"x": 2.0, "g": "B"}, {"x": 3.0, "g": "C"}]
    )
    r = client.post("/v1/mann-whitney", headers=auth_headers, json={
        "data": rows,
        "variables": {"column": "x", "group_by": "g"},
    })
    assert r.status_code == 400
