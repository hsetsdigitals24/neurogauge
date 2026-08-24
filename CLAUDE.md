# Neurogauge Project Guide

## Project Overview

Neurogauge is a Next.js-based web application for managing cognitive assessment projects, sessions, and results. It includes user authentication, project management, session tracking, and data export capabilities. Statistical analytics run on a separate Python FastAPI service (see `analytics/` and ANALYTICS_BUILD_PLAN.md); users can also upload arbitrary CSV datasets and analyse them in the workbench.

## Technology Stack

- **Framework**: Next.js 16.2.4 (App Router)
- **Language**: TypeScript 5
- **Runtime**: React 19.2.4
- **Database**: Prisma 6.19.3 with migrations (PostgreSQL)
- **Authentication**: JWT (jose) + bcryptjs
- **Styling**: Tailwind CSS 4
- **UI Components**: Lucide React icons, Framer Motion animations
- **Linting**: ESLint 9
- **Analytics service**: Python 3.12 FastAPI in `analytics/` (pingouin, statsmodels, scipy, semopy, sklearn); stateless compute sidecar deployed on a VPS via Docker

## Important Notes

⚠️ **Next.js Breaking Changes**: This project uses Next.js 16.2.4 which may have breaking changes from your training data. Always check `node_modules/next/dist/docs/` before implementing new features.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages and layouts
│   ├── api/            # API routes (auth, projects, sessions, results, export)
│   │   ├── analytics/[...path]/  # Auth'd proxy → Python analytics service
│   │   └── datasets/   # Uploaded CSV dataset CRUD (+ [id])
│   ├── auth/           # Auth pages (login, signup)
│   ├── dashboard/      # User dashboard (own projects grid; account-type driven)
│   │   ├── projects/[id]/analytics/  # Project analytics workbench
│   │   ├── sites/      # Collection centres (list + [siteId] detail)
│   │   ├── overview/   # Supervisor dashboard (institution / research_group)
│   │   └── datasets/   # Uploaded datasets list + [id]/analytics workbench
│   ├── admin/          # Admin pages
│   ├── invites/        # Project invite handling
│   ├── p/              # Public shared project pages
│   └── results/        # Results display
├── components/         # React components (Header, Stimulus)
│   ├── dashboard/      # Dashboard-shared components (ProjectCard)
│   ├── workbench/      # Analytics workbench (WorkbenchShell, DataGrid, BackendAnalysisForm, ImportCsvDialog, ComputedColumnDialog, DatasetVariableView)
│   └── stats/          # Workspace provider, analysis dialogs, client-side stat cards
├── lib/                # Utility functions
│   ├── auth.ts        # Authentication helpers
│   ├── prisma.ts      # Prisma client
│   ├── scoring.ts     # Scoring logic
│   ├── sequences.ts   # Sequence management
│   ├── csv.ts         # CSV export
│   ├── types.ts       # TypeScript types
│   ├── analytics/     # Analytics pipeline: dataset.ts (build/project columns), client.ts (runAnalysis), backendConfig.ts (analysis form defs), csvIngest.ts (header sanitise + schema infer), computeColumn.ts (computed columns), datasetAuth.ts, workbenchState.ts
│   ├── ai/            # Shared AI client (client.ts) + zod schemas (schemas.ts) for every /api/ai/* feature
│   └── stats/         # Legacy client-side stats engine + workspace types
├── middleware.ts       # Next.js middleware
└── globals.css        # Global styles
prisma/
├── schema.prisma      # Database schema (User/AccountType/Subscription, Site, Project, TestSession/Block/Trial, Dataset, AnalysisResult, …)
└── migrations/        # Database migrations
analytics/              # Python FastAPI analytics service (routers per analysis, Dockerfile, docker-compose.prod.yml, pytest in app/tests)
.github/workflows/analytics.yml  # CI/CD: pytest + SSH deploy to VPS on pushes touching analytics/
```

## Key Features

- **Authentication**: Login/signup with JWT tokens and bcrypt hashing
- **Account types & subscriptions**: Every user has an `AccountType` (`AccountType` enum: `student` / `institution` / `research_group`) chosen at signup (`src/app/auth/signup/SignupClient.tsx` — a 3-card chooser; defaults to `student`). The account type is stored on `User.accountType` and **drives**: (a) a **type-specific dashboard** (`/dashboard` branches on `accountType`: students see just their project grid; institution/research_group accounts additionally get a `SupervisorSummary` rollup + a **Sites** link on top, via shared components in `src/components/dashboard/`); and (b) the **per-type subscription plans**. **There is no workspace/organization layer** — projects belong directly to a user (`Project.ownerId`); sharing is per-project via `ProjectCollaborator`.
  - **Billing (Paystack, live)**: Plan catalog is static in `src/lib/billing/plans.ts` (**NGN, Free + one paid tier per account type, monthly**) — the DB `Subscription.planCode` references a `code` here. `src/lib/billing/paystack.ts` is a keyless-safe REST wrapper over `api.paystack.co` (init/verify transaction, fetch/disable subscription, HMAC-SHA512 webhook signature verify); `src/lib/billing/subscription.ts` has `resolveEntitlements` (falls back to the free plan unless an **active paid** subscription exists), `activateSubscription`/`deactivateSubscription`, and `hasAi`/`withinLimit` gating helpers (enforcement is incremental — limits are defined but mostly not yet enforced). ⚠️ Requires `PAYSTACK_SECRET_KEY`; without it the `/api/billing/*` routes return **503** and the UI (`/dashboard/billing`) shows an "unavailable" state (same convention as `OPENAI_API_KEY`). Paystack **plan codes** for paid plans come from env `PAYSTACK_PLAN_<UPPER_PLANCODE>` (e.g. `PAYSTACK_PLAN_STUDENT_PRO`). Checkout → Paystack redirect → callback `/dashboard/billing?reference=…` → `/api/billing/verify`; the `/api/billing/webhook` keeps status in sync (idempotent via the unique transaction `reference` + user-keyed subscription upsert). `PaymentTransaction` is the transaction ledger. `resolveEntitlements` is surfaced on `/api/auth/me`.
    - **One-off products (pay-as-you-go)**: alongside the recurring plans, `src/lib/billing/products.ts` is a static catalog of **one-off** purchases (no plan code / interval): a **project pass** (`kind:"project"` — unlocks one extra project beyond the plan cap) and **AI credit packs** (`kind:"ai_credits"`). Balances live on `User.projectCredits` / `User.aiCredits` (source of truth; `PaymentTransaction.purpose` ∈ `subscription|project|ai_credits` + `quantity` record what a payment grants). Product checkout is `POST /api/billing/checkout/product {productCode}` — a single Paystack charge (no `plan`). Both the verify route and the `charge.success` webhook now converge on one **idempotent** `fulfillTransaction` (`src/lib/billing/fulfilment.ts`) that atomically claims the transaction (`status != success → success`) and, only for the winning caller, credits the right balance (or activates the subscription) — so verify + webhook can't double-credit. `GET /api/billing/products` returns the catalog + the caller's balances; the `/dashboard/billing` page renders them under a "Buy as you go" section.
    - **Enforcement (now live)**: `POST /api/projects` enforces the plan's `projects` cap — over the cap it atomically consumes one `projectCredits` pass (402 `project_limit` if none, and the user isn't on an unlimited paid plan). AI **data-analysis** calls (`/api/ai/recommend-test`, `/api/ai/interpret`) are **metered in credits, independent of the subscription**: each reserves one credit via `spendAiCredit` (402 `no_ai_credits` when empty) and refunds via `refundAiCredit` if the model call fails. Questionnaire generation (`/api/ai/questionnaire`) stays unmetered.
- **Projects & sharing** (no workspace layer): Every project belongs directly to a user (`Project.ownerId`). `/dashboard` shows the user's **own projects** grid + a **New project** / **Datasets** action row; projects owned by others surface under "Shared with me" (via `ProjectCollaborator`). Sharing is per-project only — invite collaborators by email (`/api/projects/[id]/invite` → `/invites/[token]`).
  - **New-project chooser**: `/dashboard/projects/new` shows a **type chooser** (3 cards) that branches on `?type=`. The page (`src/app/dashboard/projects/new/page.tsx`) is a thin router over three co-located client components: `ProjectTypeChooser.tsx` (default, no `type`), `NBackForm.tsx` (`?type=nback` — the full N-back study config, creates a `Project`), and `AiQuestionnaireForm.tsx` (`?type=ai-questionnaire`). The three flows are: **Upload dataset** (links to `/dashboard/datasets` upload), **N-back project**, and **AI questionnaire generation**.
  - **AI questionnaire (functional end-to-end)**: A questionnaire is a `Project` whose `config.kind === "questionnaire"` (`QuestionnaireConfig`/`QItem` in `src/lib/types.ts`; `isQuestionnaireConfig` guard) — **no DB migration**; questions live in `Project.config` (Json), responses in `TestSession.customAnswers` keyed by question `id`.
    - **Generate**: `AiQuestionnaireForm.tsx` POSTs the setup to `/api/ai/questionnaire`, which uses the shared AI client (`src/lib/ai/client.ts`, ChatGPT/OpenAI via the `ai` SDK + `@ai-sdk/openai` + `zod`, `src/lib/ai/schemas.ts`) to draft validated items. ⚠️ Requires `OPENAI_API_KEY` (optional `AI_MODEL`, default `gpt-5.1`); without it the route returns **503** and the UI falls back to a manual builder. Both paths use the shared `QuestionnaireBuilder` (`src/components/questionnaire/`) to review/edit/reorder items, then `POST /api/projects` with the questionnaire config.
    - **Collect**: the public page (`src/app/p/[shareToken]/page.tsx`) branches on `isQuestionnaireConfig` to render `QuestionnaireRunner` (consent → email → questions → done; no demographics). Submits to the shared `POST /api/public/[shareToken]/sessions` which branches to store `answers` in `customAnswers` (defaults the N-back-only `taker*` fields to `""`), reusing the `clientSubmissionId` dedup + analytics-cache purge.
    - **Analyze**: `loadProjectDataset` (`src/lib/analytics/dataset.ts`) branches via `buildQuestionnaireDataset` into a **wide** dataset (one row per respondent, one column per question `key`; likert/numeric → numeric, else categorical) — so the existing project analytics workbench, analytics proxy, and CSV export (`/api/projects/[id]/export` emits a `_responses.csv`) all work unchanged. The project detail page (`src/app/dashboard/projects/[id]/page.tsx`) branches its Config tab to the builder and its Results tab to a responses table.
- **Multicenter studies & supervisor dashboard** (institution / research_group accounts): a user can register collection **centres** (`Site` model — `name`, user-unique `code`, `location`, `principalInvestigator`; belongs to a `User`, cascade-deleted with them). `TestSession.siteId` (nullable, `onDelete: SetNull`) tags each session with the centre it was collected at.
  - **Sites management** (`/dashboard/sites` + `/dashboard/sites/[siteId]`): register/edit/delete centres and view per-site participants. Codes are slugified and immutable so links keep working. Deleting a site keeps its sessions (they become unassigned). Backed by `GET/POST /api/sites` and `GET/PATCH/DELETE /api/sites/[siteId]` (all scoped to the caller by `Site.userId`).
  - **Tagging**: online via a per-site link `/p/[shareToken]?site=<code>` — the public page (N-back `page.tsx` reads `window.location`, `QuestionnaireRunner` via a `siteCode` prop) forwards `siteCode` to `POST /api/public/[shareToken]/sessions`, which resolves it to a `Site` owned by the **project's owner** (unknown codes leave the session untagged). Offline via a **site selector in the CSV import dialog** (`POST /api/projects/[id]/import` accepts `siteId`, validated against the project owner's sites). The project **Collect** tab surfaces per-site copy links (when the caller has sites, fetched from `/api/sites`).
  - **Supervisor dashboard** (`/dashboard/overview` + the `SupervisorSummary` rollup on `/dashboard`): rolls all of the caller's own projects into headline totals (projects, sites, participants, completion %), a 30-day collection sparkline, **per-project** and **per-site (centre)** breakdowns with completion, and recent activity — backed by `GET /api/dashboard` (aggregates lightweight session facts server-side; never loads answers/trials).
- **Project Management**: Create, invite users, manage projects
- **Online + offline collection** (both N-back and questionnaire projects): the project detail page (`src/app/dashboard/projects/[id]/page.tsx`) has a **Collect** tab (`CollectTab`/`ImportDataDialog`, co-located) with two modes.
  - **Online**: the existing public share link (`/p/[shareToken]`) — participants complete it in a browser, sessions POST live.
  - **Offline**: a **printable paper form** at `/p/[shareToken]/print` (`src/app/p/[shareToken]/print/page.tsx`, public, fetches config from `/api/public/[shareToken]`; questionnaire → fill-in form, N-back → a metrics/TLX/custom-questions recording sheet; `window.print()` + `@media print` styles in `globals.css` hiding `.no-print`), plus **bulk CSV upload** via `POST /api/projects/[id]/import`. Import parses the CSV (`parseCsv`), tolerantly matches each column to a question by `key`/prompt/sanitised form (so re-importing the project's exported CSV round-trips), maps an `Email`/`age`/`handedness`/`education` column for N-back, optionally tags rows with a `siteId` (validated against the project owner's sites), creates one `TestSession` per row (`consentGiven: true`, taker fields default `""` for questionnaires), and purges the analytics cache. Uploaded rows flow into Results, analytics and export exactly like online submissions.
- **Session Management**: Track user sessions across projects
- **Analytics Workbench**: SPSS-style workbench over project data (descriptives, t-tests, ANOVA, correlation, regression, reliability, ROC, GLM, SEM, …) computed by the Python service
- **AI Statistician** (AI-assisted analysis, first vertical slice built; requires `OPENAI_API_KEY`): shared AI client (`src/lib/ai/`) drives two workbench features.
  - **Recommend a test**: the workbench toolbar's **AI Statistician** button opens a slide-over (`src/components/workbench/AiStatistician.tsx`). The researcher types a question; the client POSTs the current `schema` + `n` to `/api/ai/recommend-test`, which prompts the model (constrained by `ANALYSIS_KEYS` / the analysis capability menu in `src/lib/ai/schemas.ts` + the route) to return ranked recommendations mapping the dataset's **exact columns** onto one of the workbench's backend analyses, with rationale, assumptions, alternatives and a confidence badge. Recs referencing unknown keys/columns are dropped server-side. "Open this analysis" dispatches `openDialog` for the matching `DialogKey` (the researcher then fills the shown variable mapping — **field pre-fill is a future enhancement**).
  - **Interpret results**: after any backend analysis runs, `BackendResultPanel` shows an **Interpret with AI** button that POSTs the run's stats/table/warnings + variable mapping to `/api/ai/interpret`, returning a plain-language summary, a copyable **APA 7th-edition** write-up, significance flag, effect-size note and caveats. The route interprets only the numbers it's given (no re-run; result payloads are already small).
  - ⚠️ **Still planned (rest of the AI-stats feature set, not yet built)**: automatic **sample-size / power** calculation, **AI participant randomization**, **APA tables & figures** export, and **Results-section drafting**. These will extend the same `src/lib/ai/` client + `/api/ai/*` route pattern.
- **Uploaded Datasets**: Upload arbitrary CSVs (`/dashboard/datasets`), with inferred + freely editable variable types/labels, computed columns, and the same server analyses; accessible to project collaborators when linked to a project
- **Result Caching**: `AnalysisResult` caches analysis output per project *or* dataset (keyed by params hash); dataset edits purge their cache
- **Data Export**: Export results as CSV
- **Public Sharing**: Share projects via public tokens
- **Database**: Prisma ORM with migrations

## Common Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run database migrations
npm run db:push         # Push schema to database
npm run db:studio       # Open Prisma Studio
```

## API Routes

- `/api/auth/login` - User login
- `/api/auth/signup` - User registration
- `/api/auth/logout` - User logout
- `/api/auth/me` - Get current user (returns `user` incl. `accountType` + resolved `entitlements`)
- `/api/auth/signup` - Register (accepts `accountType`; seeds a free-plan `Subscription`)
- `/api/billing/plans` - GET (auth'd): plan catalog for the caller's account type + current plan + `paystackConfigured`
- `/api/billing/products` - GET (auth'd): one-off product catalog (project passes + AI credit packs) + the caller's `aiCredits`/`projectCredits` balances
- `/api/billing/subscription` - GET (auth'd): caller's resolved entitlements
- `/api/billing/checkout` - POST `{planCode}` (auth'd): starts a Paystack transaction for a paid plan → `{authorizationUrl}` (503 without `PAYSTACK_SECRET_KEY`; 403 if the plan isn't for the caller's account type)
- `/api/billing/checkout/product` - POST `{productCode}` (auth'd): starts a one-off Paystack charge for a product (project pass / AI credit pack) → `{authorizationUrl}` (503 without `PAYSTACK_SECRET_KEY`)
- `/api/billing/verify` - GET `?reference=` (auth'd): verifies a completed checkout + fulfils it via idempotent `fulfillTransaction` (activates the subscription, or credits the project/AI balance); used by the callback page
- `/api/billing/webhook` - POST (Paystack, `nodejs` runtime): HMAC-verified webhook (`charge.success` → idempotent `fulfillTransaction`; `subscription.create`, `invoice.*`, `subscription.disable`) → syncs `Subscription`/`PaymentTransaction` + credit balances
- `/api/sites` - GET (list the caller's collection centres + session counts) / POST (create a site; `code` slugified + unique per user)
- `/api/sites/[siteId]` - GET (site detail + per-site participants) / PATCH (edit name/location/PI; code immutable) / DELETE (sessions kept, `siteId` set null). All scoped to the caller by `Site.userId`.
- `/api/dashboard` - GET (auth'd): supervisor aggregate over the **caller's own** projects + sites (totals, per-project + per-site breakdowns, 30-day timeline, recent activity)
- `/api/ai/questionnaire` - POST (auth'd): AI-draft questionnaire items (503 when `OPENAI_API_KEY` unset)
- `/api/ai/recommend-test` - POST (auth'd): `{schema, n, question, notes}` → ranked statistical-test recommendations mapped onto workbench analyses (validated against `ANALYSIS_KEYS`; 503 without a key; **spends 1 AI credit**, 402 `no_ai_credits` when empty, refunded on model failure)
- `/api/ai/interpret` - POST (auth'd): `{analysisLabel, variables, options, result}` → plain-language + APA interpretation of a completed analysis (503 without a key; **spends 1 AI credit**, 402 `no_ai_credits` when empty, refunded on model failure)
- `/api/projects` - Project CRUD (GET returns owned + collaborating; POST creates a project owned by the caller — enforces the plan's project cap, consuming a `projectCredits` pass over the cap, else **402** `project_limit`)
- `/api/projects/[id]` - Specific project operations
- `/api/projects/[id]/invite` - Project invitations
- `/api/projects/[id]/import` - POST (owner/collaborator): bulk-import offline-collected responses from CSV as `TestSession`s (columns matched to questions by key/prompt); returns `{created, skipped, total, errors}` and purges the analytics cache
- `/api/projects/[id]/sessions` - Session management
- `/api/sessions` - Global session endpoints
- `/api/results` - Results management
- `/api/public/[shareToken]` - Public project access
- `/api/invites/[token]` - Invite token handling
- `/api/export` - Data export
- `/api/analytics/[...path]` - Auth'd proxy to the Python analytics service. Accepts `{projectId | datasetId, variables, options, includeTrials?}`, loads rows **server-side**, projects them to only the referenced columns (keeps payloads small for the VPS), caches in `AnalysisResult`
- `/api/projects/[id]/analytics/dataset` - Long-format project dataset (`{rows, schema, n}`) for the workbench
- `/api/datasets` - Upload CSV (POST `{name, csvText, projectId?}`) / list user's datasets
- `/api/datasets/[id]` - GET (workbench load) / PATCH (schema, rows, computed columns) / DELETE (owner-only)

## Deployment & CI/CD

- **Next.js app**: Vercel — auto-deploys on every push to `main`. Function request bodies are capped at ~4.5 MB.
- **Analytics service**: self-hosted VPS at `analytics.learnogauge.com` (1.6 GB RAM). Docker container `neurogauge-analytics` binds `127.0.0.1:8000`; nginx + Let's Encrypt in front with `client_max_body_size 50m`. Started via `analytics/docker-compose.prod.yml --env-file .env.production`.
- **CI/CD**: `.github/workflows/analytics.yml` — pushes to `main` touching `analytics/` run pytest (uv, Python 3.12), then SSH-deploy to the VPS (secrets `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY`/`VPS_APP_DIR`, GitHub environment `production`) and poll `/healthz`.
- **Env contract**: `ANALYTICS_URL` and `ANALYTICS_SHARED_SECRET` must match between Vercel env vars and the VPS `analytics/.env.production` (gitignored; example in `analytics/.env.production.example`). Never regenerate the shared secret on one side only.
- **Paystack env** (billing): `PAYSTACK_SECRET_KEY` (server; gates the whole billing feature — unset ⇒ 503), `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (reserved for future inline checkout), and one `PAYSTACK_PLAN_<UPPER_PLANCODE>` per **paid** plan holding the Paystack dashboard plan code (e.g. `PAYSTACK_PLAN_STUDENT_PRO`, `PAYSTACK_PLAN_INSTITUTION_PRO`, `PAYSTACK_PLAN_RESEARCH_GROUP_PRO`). The webhook uses `PAYSTACK_SECRET_KEY` for HMAC verification; callback URLs derive from `NEXT_PUBLIC_BASE_URL`/`APP_URL`. Point the Paystack dashboard webhook at `/api/billing/webhook`.

## Database

The project uses Prisma ORM. Key commands:

- Migrations are stored in `prisma/migrations/`
- Schema is defined in `prisma/schema.prisma`
- Always run `db:generate` after schema changes
- Use `db:push` for development, migrations for production
- ⚠️ `prisma migrate dev` is interactive and aborts in non-interactive shells (e.g. when a migration triggers a warning prompt). In that case hand-author the SQL under `prisma/migrations/<timestamp>_<name>/migration.sql` (copy conventions from existing migrations) and apply with `npx prisma migrate deploy`

## Development Guidelines

1. **Type Safety**: Use TypeScript for all new code
2. **API Routes**: Follow RESTful conventions in `src/app/api/`
3. **Components**: Place reusable React components in `src/components/`
4. **Utilities**: Add helper functions to `src/lib/`
5. **Styling**: Use Tailwind CSS classes; avoid inline styles
6. **Environment Variables**: Check next.config.ts and lib/config.ts for configuration

## Linting

Run ESLint before committing:

```bash
npm run lint
```

Check `eslint.config.mjs` for rules configuration.

## Database Migrations

When modifying the schema:

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate` to create a migration
3. The migration will be saved in `prisma/migrations/`

## Authentication Flow

- Login/Signup routes handle user authentication
- JWTs are used for session management
- Passwords are hashed with bcryptjs
- The middleware (`src/middleware.ts`) handles request-level auth checks

## Common Patterns

- **API Response Format**: Follow consistent JSON response patterns
- **Error Handling**: Use appropriate HTTP status codes
- **Database Queries**: Use Prisma client from `src/lib/prisma.ts`
- **User Context**: Access current user via JWT in API routes

## Troubleshooting

- If Prisma types are missing, run `npm run db:generate`
- If database is out of sync, check `prisma/migrations/`
- For development issues, check `.next` build cache
- Ensure environment variables are properly configured
- **Large analysis payloads / 413s**: the analytics proxy never forwards the full dataset — it column-projects rows to only what the analysis references (`referencedColumns` in `src/lib/analytics/dataset.ts`) and includes trial-level rows only when a trial column (`trial_index`, `is_priming`, `rt_ms`, `correct`) is used. Column names containing non-word chars break the formula tokeniser — keys are sanitised on CSV ingest for this reason
- **`npm run lint` runs out of memory**: use `NODE_OPTIONS=--max-old-space-size=8192 npx eslint src` (or lint individual files)

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
