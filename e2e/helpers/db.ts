import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Dedicated QA database (docker container `neurogauge-qa-pg`). Hardcoded so the
// functional suite can never write to the hosted db.prisma.io database that
// .env.development.local points at.
export const QA_DATABASE_URL =
  process.env.QA_DATABASE_URL ??
  "postgresql://postgres:qa@localhost:5434/neurogauge_qa";

if (!/localhost|127\.0\.0\.1/.test(QA_DATABASE_URL)) {
  throw new Error(
    `QA_DATABASE_URL must point at a local database, got: ${QA_DATABASE_URL}`
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function qaDb(): any {
  if (!client) {
    client = new PrismaClient({ datasources: { db: { url: QA_DATABASE_URL } } });
  }
  return client;
}

export const QA_EMAIL_DOMAIN = "neurogauge.test";
export const QA_PROJECT_PREFIX = "QA-E2E ";

export const QA_USERS = {
  owner: { name: "QA Owner", email: `qa+owner@${QA_EMAIL_DOMAIN}`, password: "QaOwnerPass1!" },
  stranger: { name: "QA Stranger", email: `qa+stranger@${QA_EMAIL_DOMAIN}`, password: "QaStrangerPass1!" },
  collab: { name: "QA Collaborator", email: `qa+collab@${QA_EMAIL_DOMAIN}`, password: "QaCollabPass1!" },
  // Dedicated user for the password-reset test: its password changes mid-run,
  // so no other spec may log in as this user.
  resetter: { name: "QA Resetter", email: `qa+resetter@${QA_EMAIL_DOMAIN}`, password: "QaResetterPass1!" },
} as const;

export async function seedQaUsers() {
  const db = qaDb();
  await deleteQaData();
  for (const u of Object.values(QA_USERS)) {
    await db.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 12),
      },
    });
  }
}

export async function deleteQaData() {
  const db = qaDb();
  // User deletion cascades to projects → sessions → blocks → trials,
  // collaborators, invites, and password reset tokens.
  await db.user.deleteMany({ where: { email: { endsWith: `@${QA_EMAIL_DOMAIN}` } } });
  // Sessions submitted by QA "participants" to any leftover project.
  await db.testSession.deleteMany({ where: { takerEmail: { endsWith: `@${QA_EMAIL_DOMAIN}` } } });
  await db.project.deleteMany({ where: { name: { startsWith: QA_PROJECT_PREFIX } } });
}

export async function disconnectQaDb() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
