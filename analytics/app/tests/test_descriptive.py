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


def test_descriptive_categorical_pie(client, auth_headers):
    rows = (
        [{"x": float(v), "cat": "A"} for v in range(10)]
        + [{"x": float(v), "cat": "B"} for v in range(5)]
        + [{"x": float(v), "cat": "C"} for v in range(3)]
    )
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": rows, "variables": {"columns": ["x"], "cat_columns": ["cat"]}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "categorical" in body["stats"]
    assert body["stats"]["categorical"]["cat"]["n"] == 18
    assert any(p["type"] == "pie" for p in body["plots"])


def test_descriptive_radar(client, auth_headers):
    import numpy as np
    rng = np.random.default_rng(7)
    rows = []
    for g in ["A", "B"]:
        shift = 0 if g == "A" else 3
        for _ in range(20):
            rows.append({"v1": float(rng.normal(shift, 1)), "v2": float(rng.normal(0, 1)),
                         "v3": float(rng.normal(-shift, 1)), "grp": g})
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": rows, "variables": {"columns": ["v1", "v2", "v3"], "group_by": "grp"}},
    )
    assert r.status_code == 200, r.text
    radar = next(p for p in r.json()["plots"] if p["type"] == "radar")
    assert len(radar["plotly"]["data"]) == 2  # one trace per group


def test_descriptive_categorical_only(client, auth_headers):
    rows = [{"cat": "A"}] * 4 + [{"cat": "B"}] * 6
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": rows, "variables": {"cat_columns": ["cat"]}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert any(p["type"] == "pie" for p in body["plots"])
    assert "variable" in body["table"]["headers"]


def _bar_error_y(client, auth_headers, error_bar):
    rows = [{"x": v} for v in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]
    payload = {"data": rows, "variables": {"columns": ["x"]}}
    if error_bar is not None:
        payload["options"] = {"error_bar": error_bar}
    r = client.post("/v1/descriptive", headers=auth_headers, json=payload)
    assert r.status_code == 200, r.text
    bar = next(p for p in r.json()["plots"] if p["type"] == "bar_ci")
    return bar["plotly"]["data"][0]["error_y"]


def test_descriptive_error_bar_modes(client, auth_headers):
    # Default + CI → asymmetric bars from the confidence interval.
    for eb in (None, "ci"):
        ey = _bar_error_y(client, auth_headers, eb)
        assert ey["symmetric"] is False
        assert "arrayminus" in ey

    # SE / SD → symmetric bars, and SD bars are wider than SE bars for the same data.
    se = _bar_error_y(client, auth_headers, "se")
    sd = _bar_error_y(client, auth_headers, "sd")
    assert se["symmetric"] is True and "arrayminus" not in se
    assert sd["symmetric"] is True and "arrayminus" not in sd
    assert sd["array"][0] > se["array"][0] > 0


def test_descriptive_error_bar_invalid(client, auth_headers):
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": [{"x": 1}], "variables": {"columns": ["x"]}, "options": {"error_bar": "nope"}},
    )
    assert r.status_code == 400


def test_descriptive_missing_column(client, auth_headers):
    r = client.post(
        "/v1/descriptive",
        headers=auth_headers,
        json={"data": [{"x": 1}], "variables": {"columns": ["nope"]}},
    )
    assert r.status_code == 400
