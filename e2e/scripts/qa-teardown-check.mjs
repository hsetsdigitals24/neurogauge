import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ datasources: { db: { url: "postgresql://postgres:qa@localhost:5434/neurogauge_qa" } } });
const users = await db.user.count({ where: { email: { endsWith: "@neurogauge.test" } } });
const projects = await db.project.count({ where: { name: { startsWith: "QA-E2E " } } });
const sessions = await db.testSession.count({ where: { takerEmail: { endsWith: "@neurogauge.test" } } });
console.log(JSON.stringify({ qaUsers: users, qaProjects: projects, qaSessions: sessions }));
await db.$disconnect();
