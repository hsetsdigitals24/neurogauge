import numpy as np


def test_roc_perfect_separation(client, auth_headers):
    # Class 0 scores in 0..1, class 1 scores in 1..2 — perfect AUC.
    rows = ([{"y": 0, "score": float(s)} for s in np.linspace(0, 1, 50)]
            + [{"y": 1, "score": float(s)} for s in np.linspace(1.001, 2, 50)])
    r = client.post("/v1/roc", headers=auth_headers, json={
        "data": rows, "variables": {"truth": "y", "score": "score"},
        "options": {"n_bootstrap": 200},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["auc"] > 0.99
    assert s["auc_ci_low"] is not None and s["auc_ci_high"] is not None
    assert s["optimal_sensitivity"] >= 0.95


def test_roc_random(client, auth_headers):
    rng = np.random.default_rng(0)
    n = 200
    rows = [{"y": int(rng.integers(0, 2)), "score": float(rng.uniform())} for _ in range(n)]
    r = client.post("/v1/roc", headers=auth_headers, json={
        "data": rows, "variables": {"truth": "y", "score": "score"},
        "options": {"n_bootstrap": 100},
    })
    assert r.status_code == 200
    s = r.json()["stats"]
    assert 0.35 < s["auc"] < 0.65


def test_roc_with_fixed_thresholds(client, auth_headers):
    rng = np.random.default_rng(1)
    n = 100
    rows = [{"y": int(rng.integers(0, 2)), "score": float(rng.uniform())} for _ in range(n)]
    r = client.post("/v1/roc", headers=auth_headers, json={
        "data": rows, "variables": {"truth": "y", "score": "score"},
        "options": {"thresholds": [0.3, 0.5, 0.7], "n_bootstrap": 100},
    })
    assert r.status_code == 200
    thresh_rows = r.json()["stats"]["thresholds"]
    # 1 optimal + 3 fixed
    assert len(thresh_rows) == 4
