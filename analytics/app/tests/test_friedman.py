import numpy as np


def test_friedman_significant_with_posthoc(client, auth_headers):
    rng = np.random.default_rng(5)
    rows = []
    for sid in range(30):
        base = rng.normal(0, 1)
        rows.append({"sid": sid, "time": "admission", "y": float(base)})
        rows.append({"sid": sid, "time": "day7", "y": float(base + 2 + rng.normal(0, 0.5))})
        rows.append({"sid": sid, "time": "month3", "y": float(base + 4 + rng.normal(0, 0.5))})
    r = client.post("/v1/friedman", headers=auth_headers, json={
        "data": rows,
        "variables": {"dv": "y", "within": "time", "subject": "sid"},
        "options": {"post_hoc": "wilcoxon", "alpha": 0.05},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["p_value"] < 0.05
    assert s["significant"] is True
    assert s["q"] is not None
    assert "post_hoc" in s
    assert s["post_hoc"]["headers"]


def test_friedman_missing_subject(client, auth_headers):
    r = client.post("/v1/friedman", headers=auth_headers, json={
        "data": [{"y": 1, "time": "t1"}],
        "variables": {"dv": "y", "within": "time"},
    })
    assert r.status_code == 400
