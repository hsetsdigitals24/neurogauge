import numpy as np


def test_sem_one_factor(client, auth_headers):
    rng = np.random.default_rng(20)
    n = 300
    latent = rng.normal(0, 1, size=n)
    rows = []
    for f in latent:
        rows.append({
            "i1": float(0.8 * f + rng.normal(0, 0.5)),
            "i2": float(0.7 * f + rng.normal(0, 0.5)),
            "i3": float(0.9 * f + rng.normal(0, 0.5)),
        })
    r = client.post("/v1/sem", headers=auth_headers, json={
        "data": rows,
        "variables": {"model": "F =~ i1 + i2 + i3"},
        "options": {"alpha": 0.05},
    })
    assert r.status_code == 200, r.text
    s = r.json()["stats"]
    assert s["model"] == "SEM"
    assert len(s["coefficients"]) > 0
    assert "fit_indices" in s
    # factor loadings (semopy reports them as `indicator ~ F`) should be recovered
    loadings = [c for c in s["coefficients"] if c["op"] == "~" and c["rval"] == "F"]
    assert len(loadings) >= 2
    assert "CFI" in s["fit_indices"]


def test_sem_missing_model(client, auth_headers):
    r = client.post("/v1/sem", headers=auth_headers, json={
        "data": [{"i1": 1.0, "i2": 2.0, "i3": 3.0}],
        "variables": {},
    })
    assert r.status_code == 400
