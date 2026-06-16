import numpy as np


def test_growth_trend(client, auth_headers):
    rng = np.random.default_rng(30)
    rows = []
    for sid in range(40):
        base = rng.normal(0, 1)
        for t, off in [("t1", 0), ("t2", 2), ("t3", 4)]:
            rows.append({"sid": sid, "time": t, "score": float(base + off + rng.normal(0, 0.4))})
    r = client.post("/v1/growth", headers=auth_headers, json={
        "data": rows,
        "variables": {"dv": "score", "time": "time", "subject": "sid"},
        "options": {"ci_level": 0.95},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["stats"]
    assert s["time_levels"] == ["t1", "t2", "t3"]
    assert any(p["type"] == "growth" for p in body["plots"])
    # means should increase across time
    means = [row["mean"] for row in s["rows"]]
    assert means[0] < means[1] < means[2]


def test_growth_grouped(client, auth_headers):
    rng = np.random.default_rng(31)
    rows = []
    for sid in range(30):
        for g, slope in [("A", 1.0), ("B", 3.0)]:
            for t in range(1, 4):
                rows.append({"sid": f"{g}{sid}", "group": g, "time": t,
                             "score": float(slope * t + rng.normal(0, 0.5))})
    r = client.post("/v1/growth", headers=auth_headers, json={
        "data": rows,
        "variables": {"dv": "score", "time": "time", "group": "group"},
    })
    assert r.status_code == 200, r.text
    plot = next(p for p in r.json()["plots"] if p["type"] == "growth")
    assert len(plot["plotly"]["data"]) == 2  # one line per group


def test_growth_missing_time(client, auth_headers):
    r = client.post("/v1/growth", headers=auth_headers, json={
        "data": [{"score": 1, "time": "t1"}],
        "variables": {"dv": "score"},
    })
    assert r.status_code == 400
