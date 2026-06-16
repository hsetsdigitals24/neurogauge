import numpy as np


def test_one_way_anova_significant(client, auth_headers):
    rng = np.random.default_rng(0)
    rows = (
        [{"y": float(v), "g": "A"} for v in rng.normal(0, 1, size=30)]
        + [{"y": float(v), "g": "B"} for v in rng.normal(2, 1, size=30)]
        + [{"y": float(v), "g": "C"} for v in rng.normal(4, 1, size=30)]
    )
    r = client.post("/v1/anova", headers=auth_headers, json={
        "data": rows, "variables": {"dv": "y", "between": "g"},
        "options": {"post_hoc": "tukey"},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    # Look for the row corresponding to the between factor
    p_vals = [row.get("p_unc") for row in body["stats"]["rows"] if row.get("Source") == "g"]
    assert p_vals and p_vals[0] < 0.001
    assert "post_hoc" in body["stats"]


def test_two_way_anova(client, auth_headers):
    rng = np.random.default_rng(1)
    rows = []
    for f1 in ["x", "y"]:
        for f2 in ["lo", "hi"]:
            mu = (0 if f1 == "x" else 2) + (0 if f2 == "lo" else 1)
            rows += [{"y": float(v), "f1": f1, "f2": f2}
                     for v in rng.normal(mu, 1, size=25)]
    r = client.post("/v1/anova", headers=auth_headers, json={
        "data": rows, "variables": {"dv": "y", "between": ["f1", "f2"]},
        "options": {"post_hoc": "none"},
    })
    assert r.status_code == 200, r.text
    sources = {row.get("Source") for row in r.json()["stats"]["rows"]}
    assert "f1" in sources and "f2" in sources


def test_rm_anova_empty_within_factor(client, auth_headers):
    # within factor entirely missing/null → clean 400, not a 500 (regression).
    rows = [{"y": float(i), "cond": None, "sid": i % 10} for i in range(60)]
    r = client.post("/v1/anova", headers=auth_headers, json={
        "data": rows,
        "variables": {"dv": "y", "within": "cond", "subject": "sid"},
        "options": {"post_hoc": "bonferroni"},
    })
    assert r.status_code == 400, r.text


def test_anova_single_level_factor(client, auth_headers):
    rows = [{"y": float(i), "g": "only"} for i in range(30)]
    r = client.post("/v1/anova", headers=auth_headers, json={
        "data": rows, "variables": {"dv": "y", "between": "g"},
    })
    assert r.status_code == 400


def test_anova_missing_dv(client, auth_headers):
    r = client.post("/v1/anova", headers=auth_headers, json={
        "data": [{"y": 1, "g": "A"}], "variables": {"between": "g"},
    })
    assert r.status_code == 400
