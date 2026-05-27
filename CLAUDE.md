# Neurogauge Project Guide

## Project Overview

Neurogauge is a Next.js-based web application for managing cognitive assessment projects, sessions, and results. It includes user authentication, project management, session tracking, and data export capabilities.

## Technology Stack

- **Framework**: Next.js 16.2.4 (App Router)
- **Language**: TypeScript 5
- **Runtime**: React 19.2.4
- **Database**: Prisma 6.19.3 with migrations
- **Authentication**: JWT (jose) + bcryptjs
- **Styling**: Tailwind CSS 4
- **UI Components**: Lucide React icons, Framer Motion animations
- **Linting**: ESLint 9

## Important Notes

⚠️ **Next.js Breaking Changes**: This project uses Next.js 16.2.4 which may have breaking changes from your training data. Always check `node_modules/next/dist/docs/` before implementing new features.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages and layouts
│   ├── api/            # API routes (auth, projects, sessions, results, export)
│   ├── auth/           # Auth pages (login, signup)
│   ├── dashboard/      # User dashboard
│   ├── admin/          # Admin pages
│   ├── invites/        # Project invite handling
│   ├── p/              # Public shared project pages
│   └── results/        # Results display
├── components/         # React components (Header, Stimulus)
├── lib/                # Utility functions
│   ├── auth.ts        # Authentication helpers
│   ├── prisma.ts      # Prisma client
│   ├── scoring.ts     # Scoring logic
│   ├── sequences.ts   # Sequence management
│   ├── csv.ts         # CSV export
│   └── types.ts       # TypeScript types
├── middleware.ts       # Next.js middleware
└── globals.css        # Global styles
prisma/
├── schema.prisma      # Database schema
└── migrations/        # Database migrations
```

## Key Features

- **Authentication**: Login/signup with JWT tokens and bcrypt hashing
- **Project Management**: Create, invite users, manage projects
- **Session Management**: Track user sessions across projects
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

## Database

The project uses Prisma ORM. Key commands:

- Migrations are stored in `prisma/migrations/`
- Schema is defined in `prisma/schema.prisma`
- Always run `db:generate` after schema changes
- Use `db:push` for development, migrations for production

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

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
