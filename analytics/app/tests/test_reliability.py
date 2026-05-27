import numpy as np


def test_high_reliability(client, auth_headers):
    # Construct a latent trait + noise — items should be highly reliable.
    rng = np.random.default_rng(0)
    n = 200
    latent = rng.normal(0, 1, size=n)
    rows = []
    for _ in range(n):
        rows.append({})
    items = [f"q{i}" for i in range(6)]
    for i, key in enumerate(items):
        noise = rng.normal(0, 0.4, size=n)
        vals = latent + noise
        for j, v in enumerate(vals):
            rows[j][key] = float(v)
    r = client.post("/v1/reliability", headers=auth_headers, json={
        "data": rows, "variables": {"items": items},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["cronbach_alpha"] > 0.85
    assert s["mcdonald_omega"] is not None and s["mcdonald_omega"] > 0.85
    assert len(s["per_item"]) == len(items)


def test_low_reliability_triggers_warning(client, auth_headers):
    rng = np.random.default_rng(0)
    n = 100
    items = [f"q{i}" for i in range(5)]
    rows = [{k: float(rng.normal()) for k in items} for _ in range(n)]
    r = client.post("/v1/reliability", headers=auth_headers, json={
        "data": rows, "variables": {"items": items},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["stats"]["cronbach_alpha"] < 0.5
    assert any("Cronbach" in w for w in body["warnings"])
