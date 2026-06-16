def test_auth_required(client):
    r = client.post("/v1/descriptive", json={"data": [{"x": 1}], "variables": {"columns": ["x"]}})
    assert r.status_code == 401


def test_descriptive_basic(client, auth_headers):
    rows = [{"x": v} for v in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": rows, "variables": {"columns": ["x"]}, "options": {"ci_level": 0.95}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["stats"]["x"]
    assert s["n"] == 10
    assert s["mean"] == 5.5
    assert s["median"] == 5.5
    assert round(s["sd"], 4) == round(3.02765, 4)
    assert s["min"] == 1.0 and s["max"] == 10.0
    assert s["q1"] is not None and s["q3"] is not None and s["iqr"] is not None
    assert s["q3"] >= s["q1"]
    assert round(s["iqr"], 6) == round(s["q3"] - s["q1"], 6)
    assert s["ci_low"] < s["mean"] < s["ci_high"]
    assert "csv" in body["table"]
    assert "variable" in body["table"]["headers"]
    plot_types = [p["type"] for p in body["plots"]]
    assert "boxplot" in plot_types
    assert "bar_ci" in plot_types


def test_descriptive_grouped(client, auth_headers):
    rows = (
        [{"x": v, "g": "A"} for v in [1, 2, 3]]
        + [{"x": v, "g": "B"} for v in [10, 20, 30]]
    )
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": rows, "variables": {"columns": ["x"], "group_by": "g"}},
    )
    assert r.status_code == 200
    body = r.json()
    s = body["stats"]["x"]
    assert s["A"]["mean"] == 2.0
    assert s["B"]["mean"] == 20.0
    box = next(p for p in body["plots"] if p["type"] == "boxplot")
    assert len(box["plotly"]["data"]) == 2
    bar = next(p for p in body["plots"] if p["type"] == "bar_ci")
    assert len(bar["plotly"]["data"][0]["x"]) == 2


def test_descriptive_missing_column(client, auth_headers):
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": [{"x": 1}], "variables": {"columns": ["nope"]}},
    )
    assert r.status_code == 400
