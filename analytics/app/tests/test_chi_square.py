def test_chi_square_independence_significant(client, auth_headers):
    # Strong association: most A->1, most B->2
    rows = (
        [{"g": "A", "y": "1"}] * 40 + [{"g": "A", "y": "2"}] * 10
        + [{"g": "B", "y": "1"}] * 10 + [{"g": "B", "y": "2"}] * 40
    )
    r = client.post("/v1/chi-square", headers=auth_headers, json={
        "data": rows, "variables": {"row": "g", "column": "y"},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["p_value"] < 0.001
    assert s["significant"] is True
    assert s["cramers_v"] > 0.4


def test_chi_square_independent(client, auth_headers):
    rows = (
        [{"g": "A", "y": "1"}] * 25 + [{"g": "A", "y": "2"}] * 25
        + [{"g": "B", "y": "1"}] * 25 + [{"g": "B", "y": "2"}] * 25
    )
    r = client.post("/v1/chi-square", headers=auth_headers, json={
        "data": rows, "variables": {"row": "g", "column": "y"},
    })
    assert r.status_code == 200
    s = r.json()["stats"]
    assert s["p_value"] > 0.5
    assert s["significant"] is False


def test_chi_square_low_expected_warning(client, auth_headers):
    rows = (
        [{"g": "A", "y": "1"}] * 2 + [{"g": "B", "y": "2"}] * 2
        + [{"g": "A", "y": "2"}] * 1
    )
    r = client.post("/v1/chi-square", headers=auth_headers, json={
        "data": rows, "variables": {"row": "g", "column": "y"},
    })
    assert r.status_code == 200
    assert any("expected" in w for w in r.json()["warnings"])
