# Neurogauge Analytics — Build Plan

A Python FastAPI service exposing 13 statistical analyses, called server-to-server from the existing Next.js app. Frontend stays in Next.js; Python is a stateless compute sidecar.

---

## Status (June 2026) — SHIPPED

All four endpoint phases (§5) are **built and in production**. Shipped beyond the original plan:

- **Server-side dataset rebuild + column projection** (§4): the browser never uploads rows; the proxy
  loads them server-side and forwards only the columns the analysis references. This was the fix for
  413s / OOM on the small analytics VPS (a 259 MB normality payload became single-digit MB).
- **Uploaded CSV datasets** (originally out of scope, §13): `Dataset` Prisma model, `/api/datasets`
  endpoints, a workbench dataset mode at `/dashboard/datasets/[id]/analytics`, inferred + freely editable
  variable types/labels, row-level computed columns, collaborator access, and dataset-level result caching.
- **CI/CD**: `.github/workflows/analytics.yml` — pytest then SSH deploy to the VPS on pushes touching
  `analytics/`.

Remaining backlog (designed, not built): rename column *keys* in the workbench; large-file uploads via
Vercel Blob (the Vercel function body cap is ~4.5 MB, so big CSVs need client→Blob direct upload).

---

## 0. Architecture at a glance

```
Browser ──HTTPS──▶ Next.js on Vercel
                     │
                     │  HTTPS + X-Analytics-Key shared-secret header
                     ▼
                  FastAPI analytics service (Python 3.12)
                  self-hosted VPS · Docker (neurogauge-analytics, 127.0.0.1:8000)
                  nginx + Let's Encrypt · analytics.learnogauge.com
                     │
                     ├── pingouin / statsmodels / scipy / semopy / sklearn
                     └── matplotlib + plotly (figures)

Postgres ◀── Next.js reads project data (TestSession/Block/Trial) and uploaded
             Datasets; writes cached AnalysisResult rows
```

- Python service is **stateless**. It receives a dataset payload, computes, returns JSON. No DB connection in Python.
- Next.js owns: auth, project/dataset access checks, dataset assembly from Prisma, column projection, result caching, frontend rendering.
- Python is deployed on a **self-hosted VPS** (1.6 GB RAM — payload size matters; see §4) as a single Docker container behind nginx (`client_max_body_size 50m`).

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

## 4. Data pipeline (Next.js side) — as built

Two data sources feed the same proxy:

- **Project data**: `GET /api/projects/[id]/analytics/dataset[?trials=false]` returns long-format
  `{rows, schema, n}` built by `loadProjectDataset()` in `src/lib/analytics/dataset.ts` (sessions →
  blocks → trials, deduped, plus per-project custom-question columns). Used by the workbench UI.
- **Uploaded datasets**: stored whole in the `Dataset` table (`rows` + `schema` jsonb), created by
  `POST /api/datasets` from raw CSV text. Headers are **sanitised into safe keys**
  (`src/lib/analytics/csvIngest.ts`) and types inferred (numeric vs categorical, user-overridable).

**Crucially, the browser never uploads the dataset for analysis.** It sends only
`{projectId | datasetId, variables, options, includeTrials?}` to the proxy
(`src/app/api/analytics/[...path]/route.ts`), which:

1. authorises (project owner/collaborator, or dataset owner/linked-project collaborator),
2. loads rows server-side (rebuild from Prisma, or read the stored Dataset),
3. for projects: includes trial-level rows **only** when the analysis references a trial column
   (`TRIAL_COLUMNS` = trial_index / is_priming / rt_ms / correct) — otherwise block-level, far smaller,
4. **projects each row down to just the referenced columns** (`referencedColumns()`), then
5. forwards `{data, variables, options}` to Python.

This cut a 259 MB normality payload to single-digit MB — required because the VPS has 1.6 GB RAM and a
50 MB nginx body cap.

⚠️ Gotcha: `referencedColumns()` tokenises formula strings on non-word chars, so column keys must be
`\w`-safe. CSV headers are sanitised at ingest for exactly this reason, and `custom_<uuid>` columns
(hyphenated) are matched whole-string first.

The Python service never touches Prisma. This keeps it reusable across projects and makes local testing trivial (feed it a CSV).

---

## 5. Endpoint phasing — what to build in what order

Build in priority of "value per hour of work." Item numbers reference your original list.

### Phase 1 — Foundations ✅ SHIPPED
- Repo skeleton, Dockerfile, health check, shared-secret auth, OpenAPI generation
- One Next.js proxy route: `src/app/api/analytics/[...path]/route.ts` (catch-all that forwards to Python)
- Dataset endpoint: `/api/projects/[id]/analytics/dataset`
- **Descriptive (#1)** — mean, median, mode, SD, SE, 95% CI per variable & group
- **Normality (#2)** — Shapiro-Wilk + KS + histogram + QQ-plot (both as Plotly specs)

These two unlock the UI scaffolding (pickers, plot rendering, table → CSV download) and the rest is mostly more routers with the same shape.

### Phase 2 — Inferential basics ✅ SHIPPED
- **t-test (#3)** — one-sample, paired, independent; CI at chosen alpha; Cohen's d
- **Correlation (#5)** — Pearson + Spearman + Kendall, scatter + correlation matrix heatmap
- **Chi-square (#6)** — independence + goodness-of-fit, Cramér's V, contingency table
- **ANOVA (#4)** — one-way, two-way, RM-ANOVA, Tukey + Bonferroni + Holm post-hoc, partial η²

### Phase 3 — Regression & reliability ✅ SHIPPED
- **Multiple regression (#7)** — `statsmodels.OLS`, β, SE, t, p, 95% CI, R², adj-R², VIF, residual plots
- **Logistic regression (#8)** — `statsmodels.Logit`, odds ratios with CIs, pseudo-R², classification report
- **Reliability (#10 part 1)** — Cronbach's α, McDonald's ω; effect sizes (Cohen's d/f, η², odds ratio)
- **ROC (#10 part 2)** — `sklearn.metrics`, AUC with bootstrap CI, sensitivity/specificity at chosen thresholds

### Phase 4 — Advanced ✅ SHIPPED
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
- **User auth stays in Next.js**. Browser → Next.js → Python; Python is **not** internet-routable beyond the secret check. On the VPS the container binds `127.0.0.1:8000` only — nginx is the sole public entry point.
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

Current schema (cache rows belong to either a project **or** an uploaded dataset):
```prisma
model AnalysisResult {
  id          String   @id @default(cuid())
  projectId   String?
  datasetId   String?
  analysisKey String   // e.g. "anova"
  paramsHash  String   // sha256 of projected data + variables + options
  result      Json
  createdAt   DateTime @default(now())
  project     Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  dataset     Dataset? @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  @@unique([projectId, analysisKey, paramsHash])
  @@unique([datasetId, analysisKey, paramsHash])
}
```

Next.js checks the cache before calling Python (second identical run returns `cached: true`).
Invalidation: project caches are cleared on session insert (delete by `projectId`); dataset caches are
cleared when the dataset's rows/schema are PATCHed. The `paramsHash` covers the projected data, so stale
hits are impossible regardless — the purge only prevents dead rows accumulating.

---

## 10. Frontend integration — as built

The planned picker/selector components became a full SPSS-style **workbench**
(`src/components/workbench/`), mounted at `/dashboard/projects/[id]/analytics` (project data) and
`/dashboard/datasets/[id]/analytics` (uploaded CSVs):

- `WorkbenchShell` — layout orchestrator; drives everything from `{rows, schema}` + an `AnalysisSource`
  (`{kind:"project"|"dataset", …}`); persists dataset edits via PATCH
- `AnalyzeMenu` + `DialogHost` — grouped analysis menu → slide-in analysis panel
- `BackendAnalysisForm` — schema-driven typed column pickers + options per analysis
  (field definitions in `src/lib/analytics/backendConfig.ts`); sends `{projectId|datasetId, variables, options}`
- `BackendResultPanel` — renders `stats`, downloadable `table`, `plots[]` (Plotly), `warnings[]`
- `DataGrid` / `DatasetVariableView` — data view + editable variable types/labels (dataset mode)
- `ComputedColumnDialog` — row-level computed columns (mean/sum/diff/zscore/log/recode/if-then),
  materialised into rows (`src/lib/analytics/computeColumn.ts`)
- `ImportCsvDialog` — merge rows into the current schema, or upload as a new dataset

CSV downloads reuse [src/lib/csv.ts](src/lib/csv.ts).

---

## 11. Testing

- **Python**: `pytest` against known fixtures. For each endpoint, hand-compute the expected result for a 5-row toy dataset and assert. Use R or SPSS as a cross-check when stakes are high (regression β, SEM fit indices).
- **Next.js**: contract tests against a mocked Python service (msw or a stub server). Don't unit-test wrapper code — integration-test the proxy end-to-end against a real Python container in CI.
- **Numerical tolerance**: assert to 4 decimal places; floating-point will bite at higher precision.

---

## 12. Deployment — as built

- **Local dev**: `npm run dev` for Next.js; `uvicorn --reload` (or docker compose) for Python.
- **Production**:
  - **Next.js on Vercel** — auto-deploys on every push to `main`. Function request bodies capped ~4.5 MB.
  - **Python on a self-hosted VPS** (1.6 GB RAM) — Docker container `neurogauge-analytics` started via
    `analytics/docker-compose.prod.yml --env-file .env.production`, bound to `127.0.0.1:8000` (never
    publicly exposed); nginx + Let's Encrypt serve `analytics.learnogauge.com` with
    `client_max_body_size 50m`. Only ports 22/80/443 open.
  - **CI/CD**: `.github/workflows/analytics.yml` — on pushes to `main` touching `analytics/`, run pytest
    (uv, Python 3.12), then SSH in as the `deploy` user (repo secrets `VPS_HOST`/`VPS_USER`/
    `VPS_SSH_KEY`/`VPS_APP_DIR`, GitHub environment `production`), `git pull --ff-only`,
    `docker compose up -d --build`, and poll `/healthz`.
  - **Secrets**: `ANALYTICS_URL` + `ANALYTICS_SHARED_SECRET` must match between Vercel env vars and the
    VPS `analytics/.env.production` (gitignored; example committed). Never regenerate one side only.
- **Observability**: log every request with `(analysis, n_rows, duration_ms, status)`. nginx error log on
  the VPS is the first stop for 413/5xx (`/var/log/nginx/error.log`).

---

## 13. Out of scope

~~User-uploaded CSVs~~ — **shipped** (Dataset model, `/dashboard/datasets`, editable variables, computed
columns; see Status block at top).

Still resist these until users actually ask:
- R bridge (`rpy2`) — `semopy` and `pingouin` cover the gaps
- Bayesian variants (BayesFactor t-test, Bayesian regression)
- ML beyond logistic regression (random forest etc.)
- Real-time / streaming analytics
- A graphical "model builder" UI for SEM/regression — formula strings are fine

---

## 14. Open questions — ANSWERED

1. **Where to host Python?** → Self-hosted VPS (Docker + nginx + Let's Encrypt at
   `analytics.learnogauge.com`), not Fly.io.
2. **Plot interactivity** → Plotly JSON specs rendered client-side. Confirmed worth the bundle.
3. **Who consumes results besides the dashboard?** → A printable report page exists at
   `/dashboard/projects/[id]/report` (HTML snapshot handoff).
4. **Multi-tenant scaling** → Still small; no jobs queue needed yet (§6 stands).
5. **Auth boundary** → Public-but-secret-gated: container binds `127.0.0.1:8000`; nginx terminates TLS;
   every request requires `X-Analytics-Key`.

---

## Suggested first commit (historical — long since shipped)

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
