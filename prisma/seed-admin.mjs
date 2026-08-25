// Idempotent admin seeder.
// Usage:
//   node prisma/seed-admin.mjs                       (uses ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME env, or the defaults below)
//   ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=secret node prisma/seed-admin.mjs
//
// Targets whatever DATABASE_URL is loaded (dotenv precedence). To seed prod,
// run with the prod env loaded, e.g.:  dotenv -e .env -- node prisma/seed-admin.mjs
//
// Creates (or updates) a User with isAdmin=true and a hashed password, and
// ensures a free-plan Subscription exists — mirroring /api/auth/signup.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = (process.env.ADMIN_EMAIL ?? "victorolorunda6@gmail.com").toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Victor#123";
const NAME = process.env.ADMIN_NAME ?? "Victor Olorunda";
const ACCOUNT_TYPE = process.env.ADMIN_ACCOUNT_TYPE ?? "research_group";
const FREE_PLAN = { student: "student_free", institution: "institution_free", research_group: "research_group_free" }[ACCOUNT_TYPE] ?? "student_free";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, isAdmin: true },
    create: { email: EMAIL, name: NAME, passwordHash, isAdmin: true, accountType: ACCOUNT_TYPE },
    select: { id: true, email: true, isAdmin: true, accountType: true },
  });

  const sub = await prisma.subscription.findFirst({ where: { userId: user.id } });
  if (!sub) {
    await prisma.subscription.create({
      data: { userId: user.id, planCode: FREE_PLAN, status: "inactive" },
    });
  }

  console.log(`✔ Admin ready: ${user.email} (isAdmin=${user.isAdmin}, accountType=${user.accountType})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
