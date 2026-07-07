# QA Verification Results — NeuroGauge Africa

**Date:** 7 July 2026
**Verified against:** `QAReviewReport–NeuroGaugeAfrica.md`
**Commit:** `99e8047` (+ uncommitted remediation from the previous session)
**Environments:**
- **Production** `https://www.neurogauge.africa` — read-only static/SEO/security-surface audit only; no data created.
- **Local** — full functional pass against a production build (`next build && next start`) connected to an **isolated Docker Postgres** (`neurogauge-qa-pg`, port 5434), never the hosted `db.prisma.io` database. All test data namespaced (`qa+*@neurogauge.test` users, `QA-E2E ` projects) and torn down after the run.

**Overall:** 24/24 automated E2E tests pass. Every static finding in the QA report is **confirmed on production** and **already fixed in the local working tree** (uncommitted — deploy to resolve them live). All five "requires functional verification" areas now **PASS**, except the results-lookup security concern, which is **confirmed by design** (see B1).

---

## Table A — Static findings (prod audit, `e2e/scripts/prod-audit.sh`)

| # | QA report finding | Production (live) | Local working tree |
|---|---|---|---|
| A1 | Duplicate SEO metadata (Issue 1) | **CONFIRMED** — `/`, `/auth/login`, `/auth/signup`, `/results` all serve the identical title and description; 0 Open Graph tags on any page | **FIXED** — unique per-page titles/descriptions, OG + Twitter tags, homepage JSON-LD |
| A2 | Double-space title bug (Issue 2) | **CONFIRMED** — `<title>Neurogauge  Neuroscience Lab — …</title>` on all 4 pages | **FIXED** |
| A3 | Client-side rendering / no-JS (Issue 3) | **CONFIRMED** — 0 `<form>` and 0 `<input>` elements in the no-JS HTML of login/signup/results | **PARTLY OPEN** — pages are still client-rendered by design; metadata now server-rendered, but forms still require JS (see New Findings N1 for a consequence) |
| A4 | Duplicate logo (Issue 4) | **CONFIRMED** — 3 `img[alt="Logo"]` on login/signup (header + inline + footer), 2 on results | **MOSTLY FIXED** — login/signup now render header + footer logos only; **forgot-password and reset-password pages still have the inline duplicate** (not covered by the earlier fix) |
| A5 | Missing privacy/legal docs (Issue 5) | **CONFIRMED** — no `/privacy` or `/terms` links anywhere | **FIXED** — draft `/privacy` and `/terms` pages + footer links (pending legal review) |
| A6 | Domain canonicalization | **PASS** — `http://` and apex both 308 → `https://www.neurogauge.africa` | n/a |
| A7 | HTTPS enforcement | **PASS** | n/a |
| A8 | robots.txt / sitemap.xml *(new check)* | **MISSING** — both 404 | **MISSING** — not yet created |

Evidence: run `bash e2e/scripts/prod-audit.sh` (production) or `bash e2e/scripts/prod-audit.sh http://localhost:3000` (local).

---

## Table B — Functional verification (QA report "Areas Requiring Functional Verification")

| # | Area | Status | Evidence (spec → assertions) |
|---|---|---|---|
| B1 | **Results lookup security** | **CONFIRMED-BY-DESIGN (risk stands)** | Live probe: `GET https://www.neurogauge.africa/api/results?email=<fabricated>` → **HTTP 200 + JSON array with no authentication**. Any known participant email returns that person's full sessions incl. trial-level data. The QA report's top concern is real; a fix was explicitly deferred by product decision. |
| B2 | **Unauthenticated assessment links** | **PASS** | `permissions.spec.ts`: public share link works without login (200); researcher APIs correctly 401 unauthenticated. `scoring-and-export.spec.ts`: duplicate submission with the same `clientSubmissionId` returns the existing session (200, same id) — **replay/double-submit is deduplicated**. No rate limiting exists (out of scope, worth noting). |
| B3 | **Assessment engine accuracy** | **PASS** | `project-and-assessment.spec.ts` drives a real self-paced 1-back letters study through the participant UI (consent → demographics → 9 trials → NASA-TLX ×2). Stored trials **byte-match the test's own observation log** (stimulus, response, RT > 0); all scorable trials scored correct per the n-back rule the test applied independently. |
| B4 | **Scoring math (d′, criterion, RT)** | **PASS** | `scoring-and-export.spec.ts` + independent Φ⁻¹ implementation (`e2e/helpers/dprime.ts`, Abramowitz–Stegun, deliberately different from the app's Acklam approximation). See Table C. Edge case: perfect performance yields a **finite** d′ (rate clamping to [0.01, 0.99] verified, d′ ≈ 4.6536). |
| B5 | **Data export (CSV)** | **PASS** | Wide CSV: counts, accuracy, hit/FA rates (4 dp), d′/criterion (4 dp), RT stats (1 dp), TLX values, and demographics all match expected values. Long CSV: all 22 trial rows byte-match the submitted trial data. CSV escaping verified: an answer containing commas and quotes survives as one correctly quoted field. |
| B6 | **Multi-researcher permissions** | **PASS** | `permissions.spec.ts`: unrelated researcher gets 403 on project GET/sessions/export/invite; unauthenticated gets 401; invite accept requires the invited email (wrong user → 403, anon → 401, re-accept → 409); accepted collaborator gains read/sessions/export but **still cannot invite** (owner-only); legacy `/api/export` requires auth. |
| B7 | **Auth flows** (signup/login/reset) | **PASS** | `auth-flows.spec.ts`: UI signup → dashboard with `ng_token` cookie, bcrypt-hashed password in DB; duplicate email → 409; short password → 400; wrong password → no cookie, right password → dashboard. Forgot-password: creates a sha256-hashed, unused token with ~1 h expiry; response is identical for nonexistent emails (**no email enumeration**). Reset: consumes the token (`usedAt` set), old password 401 / new password 200, token reuse → 400 (single-use), sibling tokens invalidated. |

---

## Table C — Scoring cross-check (synthetic 20-trial level-2 block)

Inputs: 5 hits (RTs 400/450/500/550/600 ms), 1 miss, 2 false alarms, 12 correct rejections (+2 priming trials, excluded).

| Metric | Independent expected | App (wide CSV export) | Result |
|---|---|---|---|
| hit_rate | 0.8333 | 0.8333 | ✓ exact |
| fa_rate | 0.1429 | 0.1429 | ✓ exact |
| accuracy | 0.8500 | 0.8500 | ✓ exact |
| d_prime | 2.0350 | agrees | ✓ within 2×10⁻³ |
| criterion | 0.0501 | agrees | ✓ within 2×10⁻³ |
| rt_mean_ms | 500.0 | 500.0 | ✓ exact |
| rt_median_ms | 500.0 | 500.0 | ✓ exact |
| rt_sd_ms | 79.06 (sample SD) | 79.06 | ✓ exact |

The tolerance covers only the difference between the two Φ⁻¹ approximations (app: Acklam ~1e-9; cross-check: A&S ~4.5e-4). The same cross-check also passed against the real UI-driven session in B3.

---

## New findings (not in the original QA report)

| # | Finding | Severity | Detail |
|---|---|---|---|
| N1 | **Pre-hydration form submit drops the reset token and leaks the password into the URL** | Low | The reset-password (and other auth) forms are client-rendered `<form>`s with `type="submit"` buttons. A submit that lands **before React hydrates** (slow connection/device) triggers a native GET form submission: the page reloads, `?token=` is lost (subsequent attempts fail with "Missing reset token"), and form values can end up in the query string — passwords in URLs reach server/proxy logs. Mitigation options: `action="javascript:void(0)"`-style guards, `method="post"` fallback, or disabling the submit until hydrated. Discovered because it made the E2E reset test flaky under load. |
| N2 | **No robots.txt or sitemap.xml** | Low (SEO) | Both 404 on production. Next.js `app/robots.ts` + `app/sitemap.ts` would close this. |
| N3 | **Inline duplicate logo remains on forgot-/reset-password pages** | Low | The earlier duplicate-logo fix covered login/signup only. |
| N4 | **No rate limiting on public endpoints** | Medium | `/api/results` (email enumeration amplifier) and `/api/public/[token]/sessions` (unauthenticated writes) accept unlimited requests. Compounds B1. |

---

## Appendix

**How to re-run**

```bash
# One-time: isolated QA database (already running)
docker run -d --name neurogauge-qa-pg -e POSTGRES_PASSWORD=qa \
  -e POSTGRES_DB=neurogauge_qa -p 5434:5432 postgres:16-alpine
DATABASE_URL="postgresql://postgres:qa@localhost:5434/neurogauge_qa" npx prisma migrate deploy

# Production static audit (read-only)
bash e2e/scripts/prod-audit.sh

# Full functional suite (builds the app, starts it on the QA DB, runs 24 tests)
npm run test:e2e

# Confirm no QA data remains
node e2e/scripts/qa-teardown-check.mjs   # → {"qaUsers":0,"qaProjects":0,"qaSessions":0}
```

**Safety notes**
- `playwright.config.ts` hardwires the QA database URL into the web server env and refuses to reuse a running server, because `.env.development.local` points at the hosted `db.prisma.io` database — tests can never write to it.
- Teardown verified after the final run: 0 QA users / projects / sessions remained.

**Limitations**
- SMTP delivery was not exercised (token creation/consumption verified at the DB level instead).
- Legacy `/api/export` verified for auth only (401), not output correctness (superseded by `/api/projects/[id]/export`).
- Browser matrix: Chromium only; mobile responsiveness and cross-browser checks from the QA report remain open.
- Production audit reflects the currently deployed build; the local fixes (Table A) resolve A1/A2/A4-partial/A5 once deployed.
