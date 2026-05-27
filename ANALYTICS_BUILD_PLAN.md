it pos# Neurogauge Analytics — Build Plan

A Python FastAPI service exposing 13 statistical analyses, called server-to-server from the existing Next.js app. Frontend stays in Next.js; Python is a stateless compute sidecar.

---

## 0. Architecture at a glance

```
Browser ──HTTPS──▶ Next.js (existing)
                     │
                     │  internal HTTPS + shared-secret header
                     ▼
                  FastAPI analytics service (Python 3.12)
                     │
                     ├── pingouin / statsmodels / scipy / semopy / sklearn
                     └── matplotlib + plotly (figures)

Postgres (existing) ◀── Next.js writes cached analysis results
```

- Python service is **stateless**. It receives a dataset payload, computes, returns JSON. No DB connection in Python.
- Next.js owns: auth, project access checks, dataset assembly from Prisma, result caching, frontend rendering.
- Deploy Python on Fly.io / Railway / Render as a single container. One small instance is enough to start.

---

## 1. Repo layout

Two options. Pick **A** unless you have a strong reason otherwise.

**A. Monorepo (recommended)** — keep Python next to Next.js:
```
nueroguage/
├── src/                       # existing Next.js
├── prisma/
├── analytics/                 # NEW — Python service
│   ├── app/
│   │   ├── main.py
│   │   ├── deps.py            # auth header check
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── descriptive.py
│   │   │   ├── normality.py
│   │   │   ├── ttest.py
│   │   │   ├── anova.py
│   │   │   ├── correlation.py
│   │   │   ├── chi_square.py
│   │   │   ├── regression.py
│   │   │   ├── reliability.py
│   │   │   ├── roc.py
│   │   │   ├── timeseries.py
│   │   │   ├── sem.py
│   │   │   └── mediation.py
│   │   ├── core/
│   │   │   ├── plots.py       # plotly spec builders
│   │   │   ├── csv_io.py      # tidy → CSV string
│   │   │   └── effsize.py     # cohen d, eta², odds ratio helpers
│   │   └── tests/
│   ├── pyproject.toml         # uv or poetry
│   ├── Dockerfile
│   └── README.md
└── ANALYTICS_BUILD_PLAN.md    # this file
```

**B. Separate repo** — fine if you want independent deploys; costs you a second CI pipeline and a synced contract.

---

## 2. Dependencies (Python)

```toml
[project]
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "pydantic>=2.9",
  "numpy>=2.1",
  "pandas>=2.2",
  "scipy>=1.14",
  "statsmodels>=0.14",
  "pingouin>=0.5.5",
  "scikit-learn>=1.5",
  "semopy>=2.3",
  "ruptures>=1.1",        # changepoint detection for time series
  "matplotlib>=3.9",
  "plotly>=5.24",
  "python-multipart>=0.0.12",
]
```

Pin versions in production. Use `uv` for dependency resolution — it's ~10× faster than pip and Docker-friendly.

---

## 3. Contract (request/response shape)

Every endpoint accepts the same envelope:

```jsonc
POST /v1/<analysis>
Headers: X-Analytics-Key: <shared secret>
Body: {
  "data": [ { "pid": "P-001", "rt": 412, "stress": 3, ... }, ... ],
  "variables": { /* analysis-specific: dv, iv, group, etc. */ },
  "options":   { /* alpha, ci_level, n_bootstrap, plot: true, ... */ }
}
```

Every endpoint returns:
```jsonc
{
  "ok": true,
  "stats": { /* tidy numbers — never strings of numbers */ },
  "table": { "csv": "...", "headers": [...], "rows": [[...]] },
  "plots": [ { "type": "histogram", "plotly": { /* spec */ } } ],
  "warnings": [ "Shapiro N>5000, results unreliable" ],
  "meta": { "n": 412, "duration_ms": 84, "version": "0.1.0" }
}
```

Lock this contract in a shared TypeScript file (`src/lib/analytics-types.ts`) generated from the FastAPI OpenAPI schema — run `openapi-typescript` in CI so frontend types stay honest.

---

## 4. Data pipeline (Next.js side)

Add **one** Next endpoint that flattens Prisma data into tidy long-format JSON the Python service consumes:

```
GET /api/projects/[id]/analytics/dataset?include=trials,tlx,custom
```

Returns:
```jsonc
{
  "rows": [
    { "session_id":"...", "pid":"P-001", "email":"...",
      "stim_type":"letters", "level":2,
      "trial_index":4, "rt_ms":612, "correct":true,
      "tlx_mental":70, "tlx_paas":7,
      "custom_q1":"3", "demographics_age":"24" },
    ...
  ],
  "schema": { /* variable types + labels */ }
}
```

The Python service never touches Prisma. This keeps it reusable across projects and makes local testing trivial (feed it a CSV).

---

## 5. Endpoint phasing — what to build in what order

Build in priority of "value per hour of work." Item numbers reference your original list.

### Phase 1 — Foundations (Week 1)
- Repo skeleton, Dockerfile, health check, shared-secret auth, OpenAPI generation
- One Next.js proxy route: `src/app/api/analytics/[...path]/route.ts` (catch-all that forwards to Python)
- Dataset endpoint: `/api/projects/[id]/analytics/dataset`
- **Descriptive (#1)** — mean, median, mode, SD, SE, 95% CI per variable & group
- **Normality (#2)** — Shapiro-Wilk + KS + histogram + QQ-plot (both as Plotly specs)

These two unlock the UI scaffolding (pickers, plot rendering, table → CSV download) and the rest is mostly more routers with the same shape.

### Phase 2 — Inferential basics (Week 2)
- **t-test (#3)** — one-sample, paired, independent; CI at chosen alpha; Cohen's d
- **Correlation (#5)** — Pearson + Spearman + Kendall, scatter + correlation matrix heatmap
- **Chi-square (#6)** — independence + goodness-of-fit, Cramér's V, contingency table
- **ANOVA (#4)** — one-way, two-way, RM-ANOVA, Tukey + Bonferroni + Holm post-hoc, partial η²

### Phase 3 — Regression & reliability (Week 3)
- **Multiple regression (#7)** — `statsmodels.OLS`, β, SE, t, p, 95% CI, R², adj-R², VIF, residual plots
- **Logistic regression (#8)** — `statsmodels.Logit`, odds ratios with CIs, pseudo-R², classification report
- **Reliability (#10 part 1)** — Cronbach's α, McDonald's ω; effect sizes (Cohen's d/f, η², odds ratio)
- **ROC (#10 part 2)** — `sklearn.metrics`, AUC with bootstrap CI, sensitivity/specificity at chosen thresholds

### Phase 4 — Advanced (Week 4+)
- **Statistical modelling (#9)** — `statsmodels` formula API as a general endpoint (`smf.ols`, `smf.mixedlm`, `smf.glm`); user passes a formula string. Power tool for everything not covered above.
- **Time series (#11)** — `statsmodels.tsa` for trend/seasonality; `ruptures.Pelt` for changepoint = "timing of performance decline"; growth curves via mixed-effects (`smf.mixedlm`)
- **Mediation (#13)** — `pingouin.mediation_analysis` with bootstrap CIs (Hayes-style)
- **SEM (#12)** — `semopy` with lavaan-syntax model strings; return path coefficients + fit indices (CFI, TLI, RMSEA, SRMR)

SEM and time-series are the highest-effort items — keep them last so you don't block lower-cost wins.

---

## 6. Long-running jobs

Phase-1/2/3 endpoints complete in <2s typical. **Don't add a job queue until you need it.** Watchlist (likely to need async):
- SEM with bootstrap
- Mediation with `n_boot=5000`
- RM-ANOVA on large datasets
- Time-series with multi-changepoint search

When needed: in-process `BackgroundTasks` + a `jobs` table in Postgres (Next.js writes, Next.js polls). Avoid Celery/Redis for v1 — overkill.

---

## 7. Auth and security

- **Inter-service**: single `ANALYTICS_SHARED_SECRET` env var, sent as `X-Analytics-Key` header. Verify in a FastAPI dependency.
- **User auth stays in Next.js**. Browser → Next.js → Python; Python is **not** internet-routable beyond the secret check. On Fly/Railway, bind it to a private network if possible.
- **Project access**: Next.js verifies the caller can read the project (owner or collaborator) *before* assembling the dataset. Python never sees user identities.
- **Input limits**: cap row count (e.g. 200k) and column count in Pydantic validation. Reject silently-truncated payloads.

---

## 8. Plot strategy

Return **Plotly JSON specs**, not PNG, for everything interactive. Render on the frontend with `react-plotly.js`. PNGs only for the static PDF/Word report path (use `matplotlib` → base64 there).

One helper per plot type in `analytics/app/core/plots.py`:
```python
def histogram_spec(values, bins=30, title=None) -> dict: ...
def qq_plot_spec(values) -> dict: ...
def scatter_spec(x, y, fit="ols") -> dict: ...
def correlation_heatmap_spec(matrix, labels) -> dict: ...
def roc_curve_spec(fpr, tpr, auc) -> dict: ...
```

Keep these dumb and reusable across routers.

---

## 9. Caching results

Analyses on the same dataset with the same params are deterministic — cache aggressively.

Schema addition (one new table):
```prisma
model AnalysisResult {
  id          String   @id @default(cuid())
  projectId   String
  analysisKey String   // e.g. "anova"
  paramsHash  String   // sha256 of dataset+variables+options
  result      Json
  createdAt   DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@unique([projectId, analysisKey, paramsHash])
}
```

Next.js checks cache before calling Python. Invalidate when sessions change (delete by `projectId` on session insert).

---

## 10. Frontend integration

New section in the project dashboard: `/dashboard/projects/[id]/analytics`.

Components:
- `AnalysisPicker` — list of 13 analyses, grouped (Descriptive / Inferential / Regression / Reliability / Advanced)
- `VariableSelector` — pulls schema from `/api/projects/[id]/analytics/dataset` and renders typed dropdowns (numeric vs categorical vs ordinal)
- `OptionsPanel` — analysis-specific (alpha, post-hoc method, formula box, etc.)
- `ResultView` — renders `stats` as a card, `table` as a downloadable CSV, `plots[]` via `react-plotly.js`
- `WarningsBanner` — surfaces the `warnings[]` array (small sample, normality violated, etc.)

Reuse the existing CSV download flow from [src/lib/csv.ts](src/lib/csv.ts) for the "Download as CSV" button on every result.

---

## 11. Testing

- **Python**: `pytest` against known fixtures. For each endpoint, hand-compute the expected result for a 5-row toy dataset and assert. Use R or SPSS as a cross-check when stakes are high (regression β, SEM fit indices).
- **Next.js**: contract tests against a mocked Python service (msw or a stub server). Don't unit-test wrapper code — integration-test the proxy end-to-end against a real Python container in CI.
- **Numerical tolerance**: assert to 4 decimal places; floating-point will bite at higher precision.

---

## 12. Deployment

- **Local dev**: `docker compose up` with two services — Next.js (`npm run dev`) and Python (`uvicorn --reload`). Single `.env` at root, separate envs piped in via compose.
- **Production**:
  - Python on Fly.io (cheap, supports Dockerfiles cleanly, can scale-to-zero if traffic is bursty)
  - Next.js wherever it lives now
  - Shared secret stored in both deployment platforms
  - Healthcheck `/healthz` on Python, monitored by Next.js startup
- **Observability**: log every request with `(analysis, n_rows, duration_ms, status)`. Send to whatever the rest of the stack uses; add structlog if you don't have a logger.

---

## 13. Out of scope for v1

Resist these until users actually ask:
- User-uploaded CSVs (always come from project data first)
- R bridge (`rpy2`) — `semopy` and `pingouin` cover the gaps
- Bayesian variants (BayesFactor t-test, Bayesian regression)
- ML beyond logistic regression (random forest etc.)
- Real-time / streaming analytics
- A graphical "model builder" UI for SEM/regression — formula strings are fine for v1

---

## 14. Open questions (decide before Week 1)

1. **Where to host Python?** Fly.io is the lowest-friction default. Confirm.
2. **Plot interactivity**: Plotly (recommended) or static matplotlib only? Plotly is a heavier frontend bundle (~3MB) but worth it.
3. **Who consumes results besides the dashboard?** If a future research-report PDF needs them, design `ResultView` with both interactive (Plotly) and printable (PNG) render paths from day one.
4. **Multi-tenant scaling**: are you expecting more than ~50 concurrent analyses? If yes, jobs queue moves earlier.
5. **Auth boundary**: is the Python service reachable only via private networking, or public-but-secret-gated? Private is safer; check Fly's private-IPv6 networking suits your Next.js host.

---

## Suggested first commit

```
analytics/
├── app/main.py                # FastAPI app + /healthz
├── app/deps.py                # X-Analytics-Key check
├── app/routers/descriptive.py # first real endpoint
├── app/schemas/common.py      # Envelope, Plot, Warning models
├── pyproject.toml
└── Dockerfile

src/app/api/analytics/[...path]/route.ts   # Next.js proxy
src/lib/analytics-client.ts                # typed client
src/lib/analytics-types.ts                 # generated from OpenAPI

docker-compose.yml
.env.example                                # ANALYTICS_URL, ANALYTICS_SHARED_SECRET
```

Ship that, then add one router per day until you've covered the 13.
