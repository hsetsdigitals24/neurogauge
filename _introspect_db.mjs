// Read-only DB introspection: lists tables, key columns, and applied migrations.
// Run from the project root:  node _introspect_db.mjs
import { readFileSync } from "node:fs";

// Plain `node` does not load Next's .env files, so load DATABASE_URL ourselves.
function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch { /* file may not exist */ }
}
// Later files here do NOT override earlier ones (first wins), so load in priority order.
loadEnv(".env.development.local");
loadEnv(".env.local");
loadEnv(".env");

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not found in .env.development.local / .env.local / .env");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
try {
  const tables = await p.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log("TABLES:", tables.map((t) => t.table_name).join(", "));

  for (const t of ["User", "Site", "Project", "Subscription", "PaymentTransaction", "Workspace", "WorkspaceMember", "WorkspaceInvite", "Organization", "OrganizationMember", "OrganizationInvite"]) {
    const cols = await p.$queryRawUnsafe(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY column_name`,
      t
    );
    if (cols.length) console.log(`\n${t}:`, cols.map((c) => `${c.column_name}(${c.data_type})`).join(", "));
  }

  const applied = await p.$queryRawUnsafe(
    `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`
  );
  console.log("\nAPPLIED MIGRATIONS:");
  for (const m of applied) {
    const state = m.rolled_back_at ? "ROLLED BACK" : m.finished_at ? "ok" : "PENDING/FAILED";
    console.log(`  ${m.migration_name}  [${state}]`);
  }
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  await p.$disconnect();
}
