import math


def test_two_sample_n_matches_gpower(client, auth_headers):
    # d=0.5, alpha=.05, power=.80, two-sided → ~64 per group (classic G*Power value).
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "ttest-two", "solve_for": "n",
        "effect_size": 0.5, "alpha": 0.05, "power": 0.8,
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["n_per_group"] == 64
    assert s["n_total"] == 128
    assert s["solve_for"] == "n"


def test_solve_for_power(client, auth_headers):
    # Achieved power for a modest design.
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "ttest-two", "solve_for": "power",
        "effect_size": 0.5, "alpha": 0.05, "n": 30,
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert 0 < s["power"] < 1
    assert s["n_total"] == 60


def test_solve_for_effect_size(client, auth_headers):
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "ttest-two", "solve_for": "effect_size",
        "alpha": 0.05, "power": 0.8, "n": 64,
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert math.isclose(s["effect_size"], 0.5, abs_tol=0.05)


def test_anova_requires_k_groups(client, auth_headers):
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "anova", "solve_for": "n",
        "effect_size": 0.25, "alpha": 0.05, "power": 0.8,
    })
    assert r.status_code == 400


def test_anova_sample_size(client, auth_headers):
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "anova", "solve_for": "n",
        "effect_size": 0.25, "alpha": 0.05, "power": 0.8, "k_groups": 3,
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["n_total"] > 0
    assert s["n_per_group"] * 3 >= s["n_total"]


def test_correlation_sample_size(client, auth_headers):
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "correlation", "solve_for": "n",
        "effect_size": 0.3, "alpha": 0.05, "power": 0.8,
    })
    assert r.status_code == 200, r.text
    # r=.3 needs ~84 for 80% power.
    assert 80 <= r.json()["stats"]["n_total"] <= 90


def test_chi_square_sample_size(client, auth_headers):
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "chi-square", "solve_for": "n",
        "effect_size": 0.3, "alpha": 0.05, "power": 0.8, "df": 1,
    })
    assert r.status_code == 200, r.text
    assert r.json()["stats"]["n_total"] > 0


def test_missing_effect_size_rejected(client, auth_headers):
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "ttest-two", "solve_for": "n", "alpha": 0.05, "power": 0.8,
    })
    assert r.status_code == 400


def test_unknown_test_rejected(client, auth_headers):
    r = client.post("/v1/power", headers=auth_headers, json={
        "test": "nope", "solve_for": "n", "effect_size": 0.5, "power": 0.8,
    })
    assert r.status_code == 400


def test_requires_auth(client):
    r = client.post("/v1/power", json={
        "test": "ttest-two", "solve_for": "n", "effect_size": 0.5, "power": 0.8,
    })
    assert r.status_code == 401
