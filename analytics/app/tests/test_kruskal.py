import numpy as np


def test_kruskal_significant_with_dunn(client, auth_headers):
    rng = np.random.default_rng(3)
    rows = (
        [{"y": float(v), "g": "mild"} for v in rng.exponential(1.0, size=30)]
        + [{"y": float(v), "g": "moderate"} for v in rng.exponential(3.0, size=30)]
        + [{"y": float(v), "g": "severe"} for v in rng.exponential(6.0, size=30)]
    )
    r = client.post("/v1/kruskal-wallis", headers=auth_headers, json={
        "data": rows,
        "variables": {"dv": "y", "between": "g"},
        "options": {"post_hoc": "dunn", "alpha": 0.05},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["p_value"] < 0.05
    assert s["significant"] is True
    assert s["h"] is not None
    assert s["epsilon_squared"] is not None
    assert "post_hoc" in s
    assert s["post_hoc"]["headers"]


def test_kruskal_no_posthoc(client, auth_headers):
    rng = np.random.default_rng(4)
    rows = (
        [{"y": float(v), "g": "a"} for v in rng.exponential(1.0, size=20)]
        + [{"y": float(v), "g": "b"} for v in rng.exponential(4.0, size=20)]
    )
    r = client.post("/v1/kruskal-wallis", headers=auth_headers, json={
        "data": rows,
        "variables": {"dv": "y", "between": "g"},
        "options": {"post_hoc": "none"},
    })
    assert r.status_code == 200, r.text
    assert "post_hoc" not in r.json()["stats"]


def test_kruskal_missing_dv(client, auth_headers):
    r = client.post("/v1/kruskal-wallis", headers=auth_headers, json={
        "data": [{"y": 1, "g": "a"}],
        "variables": {"between": "g"},
    })
    assert r.status_code == 400
