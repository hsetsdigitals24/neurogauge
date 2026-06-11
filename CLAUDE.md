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
│   ├── dashboard/      # User dashboard
│   │   ├── projects/[id]/analytics/  # Project analytics workbench
│   │   └── datasets/   # Uploaded datasets list + [id]/analytics workbench
│   ├── admin/          # Admin pages
│   ├── invites/        # Project invite handling
│   ├── p/              # Public shared project pages
│   └── results/        # Results display
├── components/         # React components (Header, Stimulus)
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
│   └── stats/         # Legacy client-side stats engine + workspace types
├── middleware.ts       # Next.js middleware
└── globals.css        # Global styles
prisma/
├── schema.prisma      # Database schema (Project, TestSession/Block/Trial, Dataset, AnalysisResult, …)
└── migrations/        # Database migrations
analytics/              # Python FastAPI analytics service (routers per analysis, Dockerfile, docker-compose.prod.yml, pytest in app/tests)
.github/workflows/analytics.yml  # CI/CD: pytest + SSH deploy to VPS on pushes touching analytics/
```

## Key Features

- **Authentication**: Login/signup with JWT tokens and bcrypt hashing
- **Project Management**: Create, invite users, manage projects
- **Session Management**: Track user sessions across projects
- **Analytics Workbench**: SPSS-style workbench over project data (descriptives, t-tests, ANOVA, correlation, regression, reliability, ROC, GLM, SEM, …) computed by the Python service
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
- `/api/auth/me` - Get current user
- `/api/projects` - Project CRUD
- `/api/projects/[id]` - Specific project operations
- `/api/projects/[id]/invite` - Project invitations
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
