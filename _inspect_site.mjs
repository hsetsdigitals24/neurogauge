import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const q = (sql) => p.$queryRawUnsafe(sql);
try {
  const cols = await q(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='Site' ORDER BY ordinal_position`);
  const idx = await q(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='Site'`);
  const fks = await q(`SELECT conname FROM pg_constraint WHERE conrelid = '"Site"'::regclass`);
  const rowcount = await q(`SELECT count(*)::int AS n FROM "Site"`);
  console.log(JSON.stringify({ cols, idx, fks, rowcount }, null, 2));
} catch (e) {
  console.error("ERR", e.message);
} finally {
  await p.$disconnect();
}
