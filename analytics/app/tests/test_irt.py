import numpy as np


def _irt_data(n=400, seed=50):
    rng = np.random.default_rng(seed)
    # 5 items with varying difficulty; 2PL generating model
    difficulty = np.array([-1.5, -0.5, 0.0, 0.7, 1.5])
    discrimination = np.array([1.0, 1.2, 0.8, 1.5, 1.1])
    theta = rng.normal(0, 1, n)
    rows = []
    for t in theta:
        row = {}
        for k in range(5):
            p = 1.0 / (1.0 + np.exp(-discrimination[k] * (t - difficulty[k])))
            row[f"q{k + 1}"] = int(rng.random() < p)
        rows.append(row)
    return rows


def test_irt_2pl(client, auth_headers):
    items = [f"q{k}" for k in range(1, 6)]
    r = client.post("/v1/irt", headers=auth_headers, json={
        "data": _irt_data(),
        "variables": {"items": items},
        "options": {"model": "2pl"},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["stats"]
    assert s["model"] in {"2PL", "1PL"}  # 1PL only if 2PL fell back
    assert len(s["items"]) == 5
    for it in s["items"]:
        assert "discrimination_a" in it and "difficulty_b" in it
    icc = next(p for p in body["plots"] if p["type"] == "icc")
    assert len(icc["plotly"]["data"]) == 5  # one curve per item
    # difficulty should be monotonically ordered-ish with the generating values
    diffs = [it["difficulty_b"] for it in s["items"]]
    assert diffs[0] < diffs[-1]


def test_irt_too_few_respondents(client, auth_headers):
    r = client.post("/v1/irt", headers=auth_headers, json={
        "data": [{"q1": 1, "q2": 0} for _ in range(5)],
        "variables": {"items": ["q1", "q2"]},
    })
    assert r.status_code == 400
