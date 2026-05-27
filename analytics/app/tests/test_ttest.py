import numpy as np


def test_independent_ttest_significant(client, auth_headers):
    rng = np.random.default_rng(1)
    rows = (
        [{"x": float(v), "g": "A"} for v in rng.normal(0, 1, size=50)]
        + [{"x": float(v), "g": "B"} for v in rng.normal(2, 1, size=50)]
    )
    r = client.post("/v1/ttest", headers=auth_headers, json={
        "data": rows,
        "variables": {"kind": "independent", "column": "x", "group_by": "g"},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["p_value"] < 0.01
    assert s["significant"] is True
    assert s["ci_low"] is not None and s["ci_high"] is not None


def test_paired_ttest(client, auth_headers):
    rng = np.random.default_rng(2)
    base = rng.normal(0, 1, size=30)
    rows = [{"a": float(a), "b": float(a + 0.6 + rng.normal(0, 0.5))} for a in base]
    r = client.post("/v1/ttest", headers=auth_headers, json={
        "data": rows,
        "variables": {"kind": "paired", "column_a": "a", "column_b": "b"},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["p_value"] < 0.01


def test_one_sample_ttest(client, auth_headers):
    rng = np.random.default_rng(3)
    rows = [{"x": float(v)} for v in rng.normal(5, 1, size=50)]
    r = client.post("/v1/ttest", headers=auth_headers, json={
        "data": rows,
        "variables": {"kind": "one_sample", "column": "x", "mu": 0},
    })
    assert r.status_code == 200
    assert r.json()["stats"]["p_value"] < 0.01


def test_ttest_requires_two_groups(client, auth_headers):
    rows = [{"x": v, "g": "A"} for v in [1, 2, 3, 4, 5]]
    r = client.post("/v1/ttest", headers=auth_headers, json={
        "data": rows,
        "variables": {"kind": "independent", "column": "x", "group_by": "g"},
    })
    assert r.status_code == 400
