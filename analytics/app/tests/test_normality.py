import numpy as np


def test_normal_data_passes(client, auth_headers):
    rng = np.random.default_rng(42)
    rows = [{"x": float(v)} for v in rng.normal(0, 1, size=200)]
    r = client.post(
        "/v1/normality",
        headers=auth_headers,
        json={"data": rows, "variables": {"column": "x"}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["stats"]["x"]
    assert s["n"] == 200
    assert s["shapiro_p"] > 0.05  # cannot reject normality
    assert s["ks_p"] > 0.05
    assert len(body["plots"]) == 2
    assert body["plots"][0]["type"] == "histogram"
    assert body["plots"][1]["type"] == "qq"


def test_skewed_data_fails(client, auth_headers):
    rng = np.random.default_rng(0)
    rows = [{"x": float(v)} for v in rng.exponential(scale=1.0, size=200)]
    r = client.post(
        "/v1/normality",
        headers=auth_headers,
        json={"data": rows, "variables": {"column": "x"}, "options": {"tests": ["shapiro"]}},
    )
    body = r.json()
    s = body["stats"]["x"]
    assert s["shapiro_p"] < 0.05


def test_large_n_uses_dagostino_and_bounded_plots(client, auth_headers):
    rng = np.random.default_rng(7)
    n = 20000
    rows = [{"x": float(v)} for v in rng.normal(0, 1, size=n)]
    r = client.post(
        "/v1/normality",
        headers=auth_headers,
        json={"data": rows, "variables": {"column": "x"}},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    s = body["stats"]["x"]
    assert s["n"] == n
    # Shapiro is skipped above the cap; D'Agostino K² is reported instead.
    assert "shapiro_p" not in s
    assert "dagostino_p" in s
    assert any("Shapiro-Wilk skipped" in w for w in body["warnings"])
    # Plot payloads must be bounded, not ~n points.
    hist, qq = body["plots"][0], body["plots"][1]
    assert hist["type"] == "histogram"
    assert len(hist["plotly"]["data"][0]["x"]) <= 100        # pre-binned bar, not 20k points
    assert len(qq["plotly"]["data"][0]["x"]) <= 2100         # downsampled Q-Q


def test_small_sample_warning(client, auth_headers):
    rows = [{"x": v} for v in [1.0, 2.0, 3.0, 4.0]]
    r = client.post(
        "/v1/normality",
        headers=auth_headers,
        json={"data": rows, "variables": {"column": "x"}},
    )
    assert r.status_code == 200
    assert any("unreliable" in w for w in r.json()["warnings"])
